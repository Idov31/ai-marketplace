import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import {
  MarketplaceService,
  type Platform
} from "@ai-marketplace/core";
import {
  HostProtocolConnection,
  NodeMarketplaceStorage,
  SecretRedactor,
  createHostCredentialProvider,
  hostProtocolVersion,
  toMarketplaceConfig,
  validateInitializeRequest,
  withOperationLock,
  type HostInitializeRequest,
  type MarketplaceCliConfigFile,
  type MarketplaceCliHostPolicy
} from "@ai-marketplace/node-cli";
import { DashboardApplication, startDashboardServer, type DashboardConfigurationAdapter, type DashboardServerHandle } from "./dashboardBackend.js";
import {
  configurationChanges,
  configurationIdentity,
  configurationSummary,
  dashboardAssetLoader,
  isCodexConfigFile,
  mutateDashboardConfig
} from "./dashboardCli.js";
import { NodeMcpScriptRunner } from "./mcpScriptRunner.js";

const runtimeVersion = "1.1.0";

interface RuntimeState {
  readonly initialized: HostInitializeRequest;
  readonly server: DashboardServerHandle;
  readonly application: DashboardApplication;
}

export function runHostSidecar(): void {
  const redactor = new SecretRedactor();
  let state: RuntimeState | undefined;
  let connection!: HostProtocolConnection;
  const diagnostic = (message: string): void => { process.stderr.write(`${redactor.redact(message)}\n`); };
  connection = new HostProtocolConnection(process.stdin, process.stdout, async (method, params, signal) => {
    signal.throwIfAborted();
    if (method === "initialize") {
      if (state) throw new Error("Runtime is already initialized.");
      const initialized = validateInitializeRequest(params);
      if (initialized.runtimeVersion !== runtimeVersion || initialized.extensionVersion !== runtimeVersion) throw new Error("Host and sidecar runtime versions are incompatible.");
      state = await initializeRuntime(initialized, connection, redactor, diagnostic);
      return {
        protocolVersion: hostProtocolVersion,
        runtimeVersion,
        origin: state.server.origin,
        launchUrl: await state.server.issueLaunchUrl(),
        platform: initialized.platform,
        scopes: initialized.workspaceRoot ? ["workspace", "global", "cloud"] : ["global"]
      };
    }
    if (!state) throw new Error("Runtime has not been initialized.");
    if (method === "status") return { running: true, platform: state.initialized.platform, origin: state.server.origin };
    if (method === "launch") return { launchUrl: await state.server.issueLaunchUrl() };
    if (method === "refresh") { const value = await state.application.refresh(); signal.throwIfAborted(); return value; }
    if (method === "diagnose") { const value = await state.application.diagnose(); signal.throwIfAborted(); return value; }
    if (method === "shutdown") {
      await state.server.close();
      state = undefined;
      setTimeout(() => {
        connection.close();
        process.stdin.destroy();
        process.exitCode = 0;
      }, 25);
      return { stopped: true };
    }
    throw new Error(`Host request method '${method}' is not allowed.`);
  }, diagnostic, (value) => redactor.redact(value));
  connection.start();
  process.stdin.once("end", () => void closeAfterPipeLoss());
  process.stdin.once("close", () => void closeAfterPipeLoss());
  process.on("uncaughtException", (error) => { diagnostic(error instanceof Error ? error.stack ?? error.message : String(error)); connection.close(); process.exitCode = 1; });
  process.on("unhandledRejection", (error) => { diagnostic(error instanceof Error ? error.stack ?? error.message : String(error)); connection.close(); process.exitCode = 1; });

  async function closeAfterPipeLoss(): Promise<void> {
    if (!state) return;
    const active = state; state = undefined;
    try { await active.server.close(); } catch (error) { diagnostic(`Pipe-loss shutdown failed: ${String(error)}`); }
    process.exit(1);
  }
}

async function initializeRuntime(
  initialized: HostInitializeRequest,
  connection: HostProtocolConnection,
  redactor: SecretRedactor,
  diagnostic: (message: string) => void
): Promise<RuntimeState> {
  if (!isAbsolute(initialized.userRoot) || (initialized.workspaceRoot && !isAbsolute(initialized.workspaceRoot))) throw new Error("Host roots must be absolute paths.");
  const workspace = resolve(initialized.workspaceRoot ?? initialized.userRoot);
  const home = resolve(initialized.userRoot);
  const storage = new NodeMarketplaceStorage(workspace, home);
  await storage.validateRoots();
  const policy = hostPolicy(initialized.platform);
  let raw = await readHostConfiguration(connection, policy);
  const warnings: string[] = [];
  const service = new MarketplaceService({
    storage,
    configuration: { read: () => toMarketplaceConfig(raw, policy) },
    credentials: createHostCredentialProvider(connection, redactor),
    logger: { log: (line) => warnings.push(redactor.redact(line)) },
    mcpScriptRunner: new NodeMcpScriptRunner(storage)
  });
  const configuration: DashboardConfigurationAdapter = {
    read: async () => {
      raw = await readHostConfiguration(connection, policy);
      return { configured: true, preferences: { autoUpdate: raw.autoUpdate === true, autoInstallGroups: raw.autoInstallGroups ?? [] }, revision: revision(raw) };
    },
    plan: async (request) => {
      raw = await readHostConfiguration(connection, policy);
      const next = mutateDashboardConfig(raw, request);
      toMarketplaceConfig(next, policy);
      return { identity: configurationIdentity(request), summary: configurationSummary(request, next), changes: configurationChanges(raw, next, request), nextValue: next };
    },
    apply: async (nextValue) => {
      if (!isCodexConfigFile(nextValue)) throw new Error("Dashboard configuration plan is invalid.");
      await connection.callback("configuration.set", { config: nextValue });
      raw = nextValue;
    }
  };
  const application = new DashboardApplication({
    service,
    marketplaceConfig: () => toMarketplaceConfig(raw, policy),
    configuration,
    configurationPath: "visualstudio://settings/ai-marketplace",
    platform: initialized.platform,
    supportedScopes: initialized.workspaceRoot ? ["workspace", "global", "cloud"] : ["global"],
    refreshCatalog: async () => {
      warnings.length = 0;
      const packages = await service.refreshCatalog();
      return { packages, warnings: [...warnings] };
    },
    withOperationLock: (roots, action) => withOperationLock(storage, roots, action),
    diagnose: async () => ({
      ...(await service.diagnose()),
      host: initialized.host,
      hostVersion: initialized.hostVersion,
      runtimeVersion,
      platform: initialized.platform,
      workspace: initialized.workspaceRoot ?? null,
      global: initialized.userRoot,
      credentialSource: initialized.capabilities.includes("credentials") ? "host secure-store callback" : "unavailable"
    }),
    redact: (value) => redactor.redact(value)
  });
  const server = await startDashboardServer({
    workspace,
    storage,
    application,
    asset: dashboardAssetLoader(process.argv[1]),
    persistDescriptor: false,
    sanitizeError: (value) => redactor.redact(value)
  });
  void application.refresh().catch((error) => diagnostic(`Initial catalog refresh failed: ${String(error)}`));
  return { initialized, server, application };
}

async function readHostConfiguration(connection: HostProtocolConnection, policy: MarketplaceCliHostPolicy): Promise<MarketplaceCliConfigFile> {
  const response = await connection.callback("configuration.get", {});
  const raw = isRecord(response) && "config" in response ? response.config : response;
  if (!isCodexConfigFile(raw)) throw new Error("Host configuration response must contain a schemaVersion 1 config.");
  toMarketplaceConfig(raw, policy);
  return raw;
}

function hostPolicy(platform: Platform): MarketplaceCliHostPolicy {
  return {
    platform,
    displayName: "Visual Studio",
    configFileName: "visualstudio.json",
    mcpConfigRelativePath: mcpConfigPath(platform),
    supportedScopes: ["workspace", "global"]
  };
}

function mcpConfigPath(platform: Platform): string {
  switch (platform) {
    case "codex": return ".codex/config.toml";
    case "cursor": return ".cursor/mcp.json";
    case "github-copilot": return ".copilot/mcp-config.json";
    case "claude": return ".claude.json";
  }
}

function revision(raw: MarketplaceCliConfigFile): string { return createHash("sha256").update(JSON.stringify(raw)).digest("hex"); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
