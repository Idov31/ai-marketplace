import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  MarketplaceService,
  type DashboardConfigurationFieldChange,
  type DashboardPlanRequest,
  type DashboardReviewValue
} from "@ai-marketplace/core";
import {
  readCodexConfig,
  toMarketplaceConfig,
  writeCodexConfig,
  type CodexConfigFile,
  type CodexRepository
} from "./config.js";
import {
  DashboardApplication,
  getDashboardServerStatus,
  readDashboardDescriptor,
  startDashboardServer,
  type DashboardAsset,
  type DashboardConfigurationAdapter,
  type DashboardServerOptions
} from "./dashboardBackend.js";
import { withOperationLock, type NodeMarketplaceStorage } from "./nodeStorage.js";
import { NodeMcpScriptRunner } from "./mcpScriptRunner.js";
import { createEnvironmentCredentialProvider, credentialSourceSummary, redactCredentials } from "@ai-marketplace/node-cli";

export interface DashboardCliContext {
  readonly workspace: string;
  readonly home: string;
  readonly env: NodeJS.ProcessEnv;
  readonly storage: NodeMarketplaceStorage;
}

export async function dashboardStart(context: DashboardCliContext): Promise<Record<string, unknown>> {
  const live = await getDashboardServerStatus(context.storage);
  if (live) {
    const launchUrl = await issueExistingLaunchUrl(context.storage);
    return { command: "dashboard.start", reused: true, ...live, launchUrl };
  }
  const entrypoint = process.argv[1];
  if (!entrypoint) throw new Error("Unable to locate the bundled AI Marketplace CLI entrypoint.");
  const child = spawn(process.execPath, [entrypoint, "dashboard", "serve", "--workspace", context.workspace], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ...context.env }
  });
  child.unref();
  const descriptor = await waitForDashboard(context.storage, 8_000);
  const status = await getDashboardServerStatus(context.storage);
  if (!status) throw new Error("AI Marketplace dashboard did not become ready.");
  return { command: "dashboard.start", reused: false, ...status, launchUrl: descriptor.launchUrl };
}

export async function dashboardServe(context: DashboardCliContext): Promise<Record<string, unknown>> {
  const options = await createDashboardServerOptions(context);
  const handle = await startDashboardServer(options);
  void options.application.refresh().catch(() => undefined);
  return { command: "dashboard.serve", origin: handle.origin, port: handle.port };
}

export async function dashboardStatus(context: DashboardCliContext): Promise<Record<string, unknown>> {
  const status = await getDashboardServerStatus(context.storage);
  return status ? { command: "dashboard.status", running: true, ...status } : { command: "dashboard.status", running: false };
}

export async function dashboardStop(context: DashboardCliContext): Promise<Record<string, unknown>> {
  const descriptor = await readDashboardDescriptor(context.storage);
  if (!descriptor || !(await getDashboardServerStatus(context.storage))) return { command: "dashboard.stop", stopped: false, running: false };
  const response = await fetch(`${descriptor.origin}/api/control/stop`, {
    method: "POST",
    headers: { Host: `127.0.0.1:${descriptor.port}`, "X-Dashboard-Control": descriptor.controlToken },
    signal: AbortSignal.timeout(2_000)
  });
  if (!response.ok) throw new Error("AI Marketplace dashboard rejected the stop request.");
  return { command: "dashboard.stop", stopped: true, running: false };
}

async function createDashboardServerOptions(context: DashboardCliContext): Promise<DashboardServerOptions> {
  let raw = await readCodexConfig(context.storage);
  const warnings: string[] = [];
  const service = new MarketplaceService({
    storage: context.storage,
    configuration: { read: () => toMarketplaceConfig(raw) },
    credentials: createEnvironmentCredentialProvider(context.env),
    logger: { log: (line) => warnings.push(redactCredentials(line, context.env)) },
    mcpScriptRunner: new NodeMcpScriptRunner(context.storage)
  });
  const configuration: DashboardConfigurationAdapter = {
    read: async () => {
      raw = await readCodexConfig(context.storage);
      return {
        configured: true,
        preferences: { autoUpdate: raw.autoUpdate === true, autoInstallGroups: raw.autoInstallGroups ?? [] },
        revision: configRevision(raw)
      };
    },
    plan: async (request) => {
      raw = await readCodexConfig(context.storage);
      const next = mutateDashboardConfig(raw, request);
      toMarketplaceConfig(next);
      return { identity: configurationIdentity(request), summary: configurationSummary(request, next), changes: configurationChanges(raw, next, request), nextValue: next };
    },
    apply: async (nextValue) => {
      if (!isCodexConfigFile(nextValue)) throw new Error("Dashboard configuration plan is invalid.");
      await writeCodexConfig(context.storage, nextValue);
      raw = nextValue;
    }
  };
  const application = new DashboardApplication({
    service,
    marketplaceConfig: () => toMarketplaceConfig(raw),
    configuration,
    refreshCatalog: async () => {
      warnings.length = 0;
      const packages = await service.refreshCatalog();
      return { packages, warnings: warnings.filter(isDashboardRefreshWarning) };
    },
    withOperationLock: (roots, action) => withOperationLock(context.storage, roots, action),
    diagnose: async () => ({
      ...(await service.diagnose()),
      workspace: context.workspace,
      global: context.home,
      credentialSource: credentialSourceSummary(context.env, toMarketplaceConfig(raw).repositories ?? [])
    })
  });
  return { workspace: context.workspace, storage: context.storage, application, asset: dashboardAssetLoader(process.argv[1]) };
}

function mutateDashboardConfig(
  raw: CodexConfigFile,
  request: Extract<DashboardPlanRequest, { readonly action: "set-preferences" | "source-add" | "source-update" | "source-remove" }>
): CodexConfigFile {
  if (request.action === "set-preferences") {
    return { ...raw, autoUpdate: request.autoUpdate, autoInstallGroups: [...new Set(request.autoInstallGroups.map((group) => group.trim()).filter(Boolean))].sort() };
  }
  const repositories = [...(raw.repositories ?? [])];
  const sourceId = request.action === "source-remove" ? request.sourceId : request.source.id;
  const index = repositories.findIndex((source) => source.id === sourceId);
  if (request.action === "source-remove") {
    if (index < 0) throw new Error(`Repository '${sourceId}' is not configured.`);
    repositories.splice(index, 1);
  } else {
    if (request.action === "source-add" && index >= 0) throw new Error(`Repository '${sourceId}' is already configured.`);
    if (request.action === "source-update" && index < 0) throw new Error(`Repository '${sourceId}' is not configured.`);
    const source: CodexRepository = { ...request.source };
    if (index < 0) repositories.push(source); else repositories[index] = source;
  }
  return { ...raw, repositories };
}

function configurationIdentity(request: Extract<DashboardPlanRequest, { readonly action: "set-preferences" | "source-add" | "source-update" | "source-remove" }>): string {
  return request.action === "set-preferences" ? "preferences" : `source:${request.action === "source-remove" ? request.sourceId : request.source.id}`;
}

function configurationSummary(request: Extract<DashboardPlanRequest, { readonly action: "set-preferences" | "source-add" | "source-update" | "source-remove" }>, nextConfig: CodexConfigFile): string {
  if (request.action === "set-preferences") return `Set auto update ${nextConfig.autoUpdate ? "on" : "off"} and automatic groups to ${nextConfig.autoInstallGroups?.join(", ") || "none"}.`;
  if (request.action === "source-remove") return `Remove repository source '${request.sourceId}'.`;
  const source = nextConfig.repositories?.find((candidate) => candidate.id === request.source.id) ?? request.source;
  const folders = source.packageFolders
    ? Object.entries(source.packageFolders).map(([type, path]) => `${type}=${path}`).join(", ")
    : "defaults";
  return `${request.action === "source-add" ? "Add" : "Update"} repository source '${source.id}': url=${source.url}, provider=${source.provider ?? "inferred"}, label=${source.label ?? source.id}, branch=${source.branch ?? "main"}, enabled=${source.enabled !== false}, allowDefaultPackages=${source.allowDefaultPackages === true}, packageFolders=${folders}.`;
}

function configurationChanges(
  raw: CodexConfigFile,
  nextConfig: CodexConfigFile,
  request: Extract<DashboardPlanRequest, { readonly action: "set-preferences" | "source-add" | "source-update" | "source-remove" }>
): readonly DashboardConfigurationFieldChange[] {
  if (request.action === "set-preferences") return [
    { field: "autoUpdate", before: raw.autoUpdate === true, after: nextConfig.autoUpdate === true },
    { field: "autoInstallGroups", before: [...(raw.autoInstallGroups ?? [])], after: [...(nextConfig.autoInstallGroups ?? [])] }
  ];
  const sourceId = request.action === "source-remove" ? request.sourceId : request.source.id;
  const previous = raw.repositories?.find((source) => source.id === sourceId);
  const next = nextConfig.repositories?.find((source) => source.id === sourceId);
  const before = reviewSource(previous);
  const after = reviewSource(next);
  const fields = ["id", "url", "provider", "label", "branch", "enabled", "allowDefaultPackages", "packageFolders"] as const;
  return fields.map((field) => ({
    field: `repositories.${sourceId}.${field}`,
    ...(before === undefined ? {} : { before: before[field] }),
    ...(after === undefined ? {} : { after: after[field] })
  }));
}

function reviewSource(source: CodexRepository | undefined): Readonly<Record<"id" | "url" | "provider" | "label" | "branch" | "enabled" | "allowDefaultPackages" | "packageFolders", DashboardReviewValue>> | undefined {
  if (!source) return undefined;
  return {
    id: source.id,
    url: source.url,
    provider: source.provider ?? "inferred",
    label: source.label ?? source.id,
    branch: source.branch ?? "main",
    enabled: source.enabled !== false,
    allowDefaultPackages: source.allowDefaultPackages === true,
    packageFolders: { ...(source.packageFolders ?? {}) }
  };
}

function dashboardAssetLoader(entrypoint: string | undefined): (path: string) => Promise<DashboardAsset | undefined> {
  const pluginRoot = resolve(dirname(entrypoint ?? process.cwd()), "..");
  const assets: Readonly<Record<string, { readonly relativePath: string; readonly contentType: string }>> = {
    "/index.html": { relativePath: "dashboard/index.html", contentType: "text/html; charset=utf-8" },
    "/styles.css": { relativePath: "dashboard/styles.css", contentType: "text/css; charset=utf-8" },
    "/app.js": { relativePath: "dashboard/app.js", contentType: "text/javascript; charset=utf-8" },
    "/assets/ai-marketplace.png": { relativePath: "assets/ai-marketplace.png", contentType: "image/png" }
  };
  return async (path) => {
    const asset = assets[path];
    if (!asset) return undefined;
    return { contentType: asset.contentType, body: await readFile(resolve(pluginRoot, asset.relativePath)) };
  };
}

async function issueExistingLaunchUrl(storage: NodeMarketplaceStorage): Promise<string> {
  const descriptor = await readDashboardDescriptor(storage);
  if (!descriptor) throw new Error("Dashboard descriptor disappeared while issuing a launch URL.");
  const response = await fetch(`${descriptor.origin}/api/control/launch`, {
    method: "POST",
    headers: { Host: `127.0.0.1:${descriptor.port}`, "X-Dashboard-Control": descriptor.controlToken },
    signal: AbortSignal.timeout(2_000)
  });
  if (!response.ok) throw new Error("Existing dashboard server did not issue a launch URL.");
  const payload = await response.json() as { launchUrl?: unknown };
  if (typeof payload.launchUrl !== "string" || !payload.launchUrl.startsWith(`${descriptor.origin}/#token=`)) throw new Error("Existing dashboard launch URL is invalid.");
  return payload.launchUrl;
}

async function waitForDashboard(storage: NodeMarketplaceStorage, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const descriptor = await readDashboardDescriptor(storage);
    if (descriptor && await getDashboardServerStatus(storage)) return descriptor;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error("Timed out while starting AI Marketplace dashboard.");
}

function configRevision(raw: CodexConfigFile): string { return createHash("sha256").update(JSON.stringify(raw)).digest("hex"); }
export function isDashboardRefreshWarning(line: string): boolean {
  return /^Unable to refresh source |^Skipping invalid package |manifest type does not match/i.test(line);
}
function isCodexConfigFile(value: unknown): value is CodexConfigFile {
  return typeof value === "object" && value !== null && (value as { schemaVersion?: unknown }).schemaVersion === 1;
}
