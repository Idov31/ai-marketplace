import { spawn } from "node:child_process";
import { lstat, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MarketplaceService, toSerializableMarketplaceModel, addHarnessPresetRoot, hasHarnessPresetPatchEntry, removeHarnessPresetRoot, resolveHarnessPresetConfig,
  type HarnessProfileManager, type InstallScope, type InstalledPackage, type MarketplaceConfig,
  type MarketplacePackage, type MarketplaceStorage, type PackageFile
} from "../../../packages/marketplace-core/src/index.ts";
import {
  NodeMarketplaceStorage, createEnvironmentCredentialProvider, readHostConfig, toMarketplaceConfig,
  type MarketplaceCliHostPolicy
} from "../../../packages/marketplace-node-cli/src/index.ts";
import { HarnessMcpScriptRunner } from "./mcpScriptRunner.ts";

export const name = "ai-marketplace-harness";
export const inject: string[] = [];

const profileName = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const bundleName = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
const policy: MarketplaceCliHostPolicy = {
  platform: "deepseek-harness", displayName: "DeepSeek Harness",
  configFileName: "deepseek-harness.json", mcpConfigRelativePath: "",
  supportedScopes: ["workspace", "global"]
};
const userHome = homedir();
const dshHome = process.env.DSH_HOME || join(userHome, ".dsh");
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testedHarnessVersion = "0.1.5-rc.3";

interface WebRequest { method?: string; headers: Record<string, string | string[] | undefined>; url?: string; on(event: string, callback: (chunk?: Buffer) => void): void; }
interface WebResponse { writeHead(status: number, headers?: Record<string, string>): void; end(body?: string): void; }
interface HostContext {
  effect(register: () => () => void, label: string): void;
  inject(names: string[], run: (ctx: HostContext) => void): void;
  webServer: { register(route: { kind: "exact"; path: string; handler: (req: WebRequest, res: WebResponse) => Promise<void> }): () => void };
  connection: { requestRejection(req: WebRequest): number | undefined };
  sessions: { get(id: string): { header: { cwd?: string } } | undefined };
  systemPrompt: { section(definition: { name: string; order: number; interpolate: boolean; text: (input: { agent?: { session?: { header?: { cwd?: string } } } }) => string }): () => void };
}

interface PresetRootOwnership {
  readonly createdPatchEntry: boolean;
  readonly baseConfig?: Readonly<Record<string, unknown>>;
  readonly roots: readonly string[];
}

export function apply(ctx: HostContext): void {
  ctx.inject(["systemPrompt"], (ready) => ready.effect(() => ready.systemPrompt.section({
    name: "ai-marketplace:rules", order: 75, interpolate: false,
    text: ({ agent }) => collectRules(agent?.session?.header?.cwd)
  }), "AI Marketplace rule instructions"));
  ctx.inject(["webServer", "connection", "sessions"], (ready) => ready.effect(() => ready.webServer.register({
    kind: "exact", path: "/ai-marketplace/api",
    handler: (req, res) => handleRequest(ready, req, res)
  }), "AI Marketplace API"));
}

async function handleRequest(ctx: HostContext, req: WebRequest, res: WebResponse): Promise<void> {
  const rejection = ctx.connection.requestRejection(req);
  if (rejection !== undefined) { respond(res, rejection, { error: "Unauthorized" }); return; }
  if (req.method !== "POST") { respond(res, 405, { error: "Method not allowed" }); return; }
  try {
    const body = await readBody(req);
    if (typeof body.profile !== "string" || !profileName.test(body.profile)) throw new Error("Invalid Harness profile.");
    const profile = body.profile;
    const session = typeof body.sessionId === "string" ? ctx.sessions.get(body.sessionId) : undefined;
    const workspace = session?.header.cwd || process.cwd();
    const storage = new HarnessStorage(workspace);
    await storage.validateRoots();
    const raw = await readHostConfig(storage, policy);
    const config: MarketplaceConfig = { ...toMarketplaceConfig(raw, policy), deepseekHarnessProfile: profile };
    const service = new MarketplaceService({
      storage, configuration: { read: () => config },
      credentials: createEnvironmentCredentialProvider(process.env),
      logger: { log: () => undefined },
      harnessProfileManager: new ProfileManager(),
      mcpScriptRunner: new HarnessMcpScriptRunner()
    });
    const action = body.action;
    if (action === "model" || action === "refresh") {
      let catalog: readonly MarketplacePackage[] = [];
      let warning: string | undefined;
      if (action === "refresh") {
        try { catalog = await service.refreshCatalog(); } catch (error) { warning = message(error); }
      }
      const installed = (await service.listInstalled()).filter((item) => item.platform === "deepseek-harness");
      const model = toSerializableMarketplaceModel({ packages: catalog.filter((pkg) => pkg.manifest.platforms.includes("deepseek-harness")),
        installed, configured: Boolean(config.repositories?.length), autoUpdateEnabled: config.autoUpdateEnabled ?? false,
        defaultPlatform: "deepseek-harness", autoInstallGroups: config.autoInstallGroups });
      respond(res, 200, { model, profile, profiles: await profiles(), warning });
      return;
    }
    if (!isAction(action) || typeof body.packageId !== "string" || typeof body.sourceId !== "string"
      || typeof body.qualifiedName !== "string" || !["workspace", "global"].includes(String(body.scope))) {
      respond(res, 400, { error: "Invalid package action" }); return;
    }
    const scope: InstallScope = body.scope as InstallScope;
    if (scope === "workspace" && !session?.header.cwd) throw new Error("Select a live Harness session with a workspace before using workspace delivery.");
    const installed = (await service.listInstalled()).filter((item) => item.platform === "deepseek-harness");
    const current = installed.find((item) => item.id === body.packageId && item.sourceId === body.sourceId
      && item.qualifiedName === body.qualifiedName
      && item.scope === scope && (!item.harnessBundle || item.harnessBundle.profile === profile)
      && (!item.harnessProfile || item.harnessProfile === profile));
    let pkg: MarketplacePackage | undefined;
    if (["install", "update", "revert", "migrate"].includes(action)) {
      const catalog = await service.refreshCatalog();
      pkg = catalog.find((item) => item.manifest.id === body.packageId && item.source.id === body.sourceId
        && item.manifest.qualifiedName === body.qualifiedName
        && item.manifest.platforms.includes("deepseek-harness"));
      if (!pkg) throw new Error("Package is absent from the selected catalog source.");
    }
    if (action === "install") await service.install(pkg!, "deepseek-harness", scope);
    else if (action === "update") await service.update(pkg!, required(current));
    else if (action === "migrate") {
      const predecessor = installed.find((item) => item.id === body.predecessorId && item.sourceId === body.predecessorSourceId
        && item.qualifiedName === body.predecessorQualifiedName && item.scope === scope
        && (!item.harnessBundle || item.harnessBundle.profile === profile)
        && (!item.harnessProfile || item.harnessProfile === profile));
      await service.migrate(pkg!, required(predecessor));
    }
    else if (action === "revert") {
      if (!pkg!.manifest.previousVersion) throw new Error("Package has no previous version.");
      await service.revert(pkg!, required(current), pkg!.manifest.previousVersion);
    } else if (action === "uninstall") await service.uninstall(required(current));
    else if (action === "hotload") await service.hotload(required(current));
    else await service.offload(required(current));
    respond(res, 200, { ok: true });
  } catch (error) { respond(res, 400, { error: message(error) }); }
}

function required(item: InstalledPackage | undefined): InstalledPackage {
  if (!item) throw new Error("No matching package is installed in this profile and scope.");
  return item;
}

function isAction(value: unknown): value is "install" | "update" | "migrate" | "revert" | "uninstall" | "hotload" | "offload" {
  return typeof value === "string" && ["install", "update", "migrate", "revert", "uninstall", "hotload", "offload"].includes(value);
}

async function readBody(req: WebRequest): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  await new Promise<void>((resolveRead, rejectRead) => {
    req.on("data", (chunk) => {
      if (!chunk) return;
      length += chunk.length;
      if (length > 16_384) rejectRead(new Error("Request is too large."));
      else chunks.push(chunk);
    });
    req.on("end", () => resolveRead());
    req.on("error", () => rejectRead(new Error("Request failed.")));
  });
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request body.");
  return value as Record<string, unknown>;
}

function respond(res: WebResponse, status: number, value: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(value));
}

async function profiles(): Promise<string[]> {
  try { return (await readdir(join(dshHome, "profiles"), { withFileTypes: true }))
    .filter((item) => item.isDirectory() && profileName.test(item.name)).map((item) => item.name).sort(); }
  catch { return ["web"]; }
}

class HarnessStorage implements MarketplaceStorage {
  private readonly ordinary: NodeMarketplaceStorage;
  private readonly harness: NodeMarketplaceStorage;
  public constructor(workspace: string) {
    this.ordinary = new NodeMarketplaceStorage(workspace, userHome);
    this.harness = new NodeMarketplaceStorage(workspace, dshHome);
  }
  public async validateRoots() { await this.ordinary.validateRoots(); await this.harness.validateRoots(); }
  private selected(scope: InstallScope, path: string): { storage: NodeMarketplaceStorage; path: string } {
    if (scope === "global" && path.startsWith(".dsh/")) return { storage: this.harness, path: path.slice(5) };
    return { storage: this.ordinary, path };
  }
  public readFile(scope: InstallScope, path: string) { const at = this.selected(scope, path); return at.storage.readFile(scope, at.path); }
  public exists(scope: InstallScope, path: string) { const at = this.selected(scope, path); return at.storage.exists(scope, at.path); }
  public writeFile(scope: InstallScope, path: string, content: Uint8Array) { const at = this.selected(scope, path); return at.storage.writeFile(scope, at.path, content); }
  public writeFileAtomic(scope: InstallScope, path: string, content: Uint8Array) { const at = this.selected(scope, path); return at.storage.writeFileAtomic(scope, at.path, content); }
  public replaceDirectory(scope: InstallScope, path: string, files: readonly PackageFile[]) { const at = this.selected(scope, path); return at.storage.replaceDirectory(scope, at.path, files); }
  public async move(scope: InstallScope, from: string, to: string) {
    const source = this.selected(scope, from); const target = this.selected(scope, to);
    if (source.storage !== target.storage) {
      if (scope !== "global" || await target.storage.exists(scope, target.path)) throw new Error("Harness move destination already exists.");
      const sourcePath = await source.storage.assertSafe("global", source.path, false);
      const files: PackageFile[] = [];
      const walk = async (directory: string): Promise<void> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = join(directory, entry.name);
          const stat = await lstat(path);
          if (stat.isSymbolicLink()) throw new Error("Harness payload contains a symlink.");
          if (stat.isDirectory()) await walk(path);
          else if (stat.isFile()) files.push({ relativePath: relative(sourcePath, path).replaceAll("\\", "/"), content: await readFile(path) });
          else throw new Error("Harness payload contains an unsupported filesystem entry.");
        }
      };
      await walk(sourcePath);
      await target.storage.replaceDirectory(scope, target.path, files);
      await source.storage.remove(scope, source.path);
      return;
    }
    await source.storage.move(scope, source.path, target.path);
  }
  public remove(scope: InstallScope, path: string) { const at = this.selected(scope, path); return at.storage.remove(scope, at.path); }
  public async listFiles(scope: InstallScope, path: string): Promise<readonly string[]> {
    if (scope === "cloud") throw new Error("Cloud delivery is unsupported for Harness.");
    const at = this.selected(scope, path);
    const root = await at.storage.assertSafe(scope, at.path, false);
    const files: string[] = [];
    const walk = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const child = join(directory, entry.name);
        const stat = await lstat(child);
        if (stat.isSymbolicLink()) throw new Error("Harness payload contains a symlink.");
        if (stat.isDirectory()) await walk(child);
        else if (stat.isFile()) files.push(relative(root, child).replaceAll("\\", "/"));
        else throw new Error("Harness payload contains an unsupported filesystem entry.");
      }
    };
    await walk(root);
    return files.sort();
  }
}

class ProfileManager implements HarnessProfileManager {
  public async ensureBridge(profile: string): Promise<void> {
    const dependency = await this.dependency(profile, name);
    if (dependency === undefined) await this.add(profile, name, "");
  }
  public async add(profile: string, bundle: string, payload: string): Promise<void> {
    const path = payload ? resolve(userHome, payload) : pluginRoot;
    await this.assertDependency(profile, bundle, path, true);
    await this.run(["plugin", "--profile", profile, "add", `file:${path.replaceAll("\\", "/")}`]);
  }
  public async remove(profile: string, bundle: string, payload: string): Promise<void> {
    await this.assertDependency(profile, bundle, resolve(userHome, payload), false);
    await this.run(["plugin", "--profile", profile, "remove", bundle]);
  }
  public async addPresetRoot(profile: string, bundlePath: string, presetRoot: string, alreadyOwned: boolean): Promise<void> {
    const bundle = this.bundlePath(bundlePath);
    const root = this.presetPath(bundle, presetRoot);
    const patch = await this.readProfilePatch(profile);
    const previous = await this.readPresetOwnership(profile);
    if (previous?.roots.includes(root) && !alreadyOwned) throw new Error("This Harness preset root is already owned by another Marketplace installation.");
    const createdPatchEntry = previous?.createdPatchEntry ?? !hasHarnessPresetPatchEntry(patch);
    const baseConfig = previous?.baseConfig ?? (createdPatchEntry ? await this.resolveBasePresetConfig(profile) : undefined);
    const nextPatch = addHarnessPresetRoot(patch, root, alreadyOwned || previous?.roots.includes(root) === true, baseConfig);
    const ownership: PresetRootOwnership = {
      createdPatchEntry,
      ...(baseConfig ? { baseConfig } : {}),
      roots: previous?.roots.includes(root) ? previous.roots : [...(previous?.roots ?? []), root]
    };
    await this.writeProfilePatch(profile, nextPatch.content);
    await this.writePresetOwnership(profile, ownership);
  }
  public async removePresetRoot(profile: string, bundlePath: string, presetRoot: string): Promise<void> {
    const bundle = this.bundlePath(bundlePath);
    const root = this.presetPath(bundle, presetRoot);
    const ownership = await this.readPresetOwnership(profile);
    if (ownership && !ownership.roots.includes(root)) return;
    const remaining = ownership?.roots.filter((item) => item !== root) ?? [];
    const next = removeHarnessPresetRoot(await this.readProfilePatch(profile), root,
      ownership?.createdPatchEntry === true && remaining.length === 0, ownership?.baseConfig);
    if (next) await this.writeProfilePatch(profile, next.content);
    if (ownership && remaining.length === 0) await this.removePresetOwnership(profile);
    else if (ownership) await this.writePresetOwnership(profile, { ...ownership, roots: remaining });
  }
  private bundlePath(relativePath: string): string {
    if (!relativePath || relativePath.split(/[\\/]/).some((segment) => segment === ".." || segment === ".")) throw new Error("Unsafe DeepSeek Harness bundle path.");
    const path = resolve(userHome, relativePath);
    const within = relative(resolve(userHome, ".ai_marketplace"), path);
    if (!within || within.startsWith("..") || within.startsWith("../") || isAbsolute(within)) throw new Error("Preset root bundle is outside Marketplace ownership.");
    return path;
  }
  private presetPath(bundle: string, relativePath: string): string {
    if (!relativePath || relativePath.split(/[\\/]/).some((segment) => segment === ".." || segment === ".")) throw new Error("Unsafe Harness preset root path.");
    const path = resolve(bundle, relativePath);
    const within = relative(bundle, path);
    if (!within || within.startsWith("..") || isAbsolute(within)) throw new Error("Harness preset root escapes its installed bundle.");
    return path.replaceAll("\\", "/");
  }
  private async readProfilePatch(profile: string): Promise<string | undefined> {
    if (!profileName.test(profile)) throw new Error("Invalid Harness profile name.");
    try { return await readFile(join(dshHome, "profiles", profile, "cordis.patch.yml"), "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  }
  private async writeProfilePatch(profile: string, content: string): Promise<void> {
    const path = join(dshHome, "profiles", profile, "cordis.patch.yml");
    const temporary = `${path}.ai-marketplace-${Date.now()}.tmp`;
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    try { await rename(temporary, path); }
    finally { await unlink(temporary).catch(() => undefined); }
  }
  private presetOwnershipPath(profile: string): string { return join(dshHome, "profiles", profile, ".ai-marketplace-agent-presets.json"); }
  private async readPresetOwnership(profile: string): Promise<PresetRootOwnership | undefined> {
    try {
      const value: unknown = JSON.parse(await readFile(this.presetOwnershipPath(profile), "utf8"));
      if (!isRecord(value) || value.version !== 1 || typeof value.createdPatchEntry !== "boolean"
        || !Array.isArray(value.roots) || value.roots.some((item) => typeof item !== "string")) {
        throw new Error("Marketplace agent-preset ownership state is invalid.");
      }
      return { createdPatchEntry: value.createdPatchEntry, ...(isRecord(value.baseConfig) ? { baseConfig: value.baseConfig } : {}), roots: value.roots as string[] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  private async writePresetOwnership(profile: string, state: PresetRootOwnership): Promise<void> {
    const path = this.presetOwnershipPath(profile);
    const temporary = `${path}.ai-marketplace-${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ version: 1, ...state }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    try { await rename(temporary, path); }
    finally { await unlink(temporary).catch(() => undefined); }
  }
  private async removePresetOwnership(profile: string): Promise<void> { await unlink(this.presetOwnershipPath(profile)).catch(() => undefined); }
  private async dependency(profile: string, bundle: string): Promise<unknown> {
    if (!profileName.test(profile) || !bundleName.test(bundle)) throw new Error("Invalid Harness profile or bundle name.");
    try {
      const value: unknown = JSON.parse(await readFile(join(dshHome, "profiles", profile, "package.json"), "utf8"));
      if (!value || typeof value !== "object") return undefined;
      const deps = (value as { dependencies?: unknown }).dependencies;
      return deps && typeof deps === "object" ? (deps as Record<string, unknown>)[bundle] : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  private async resolveBasePresetConfig(profile: string): Promise<Readonly<Record<string, unknown>> | undefined> {
    const path = join(dshHome, "profiles", profile, "package.json");
    let manifest: unknown;
    try { manifest = JSON.parse(await readFile(path, "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    if (!isRecord(manifest) || !isRecord(manifest.dsh) || !isRecord(manifest.dsh.profile) || !Array.isArray(manifest.dsh.profile.bundles)) return undefined;
    const layers: string[] = [];
    for (const bundle of manifest.dsh.profile.bundles) {
      if (typeof bundle !== "string" || !bundleName.test(bundle)) continue;
      try { layers.push(await readFile(join(dshHome, "profiles", profile, "node_modules", ...bundle.split("/"), "cordis.patch.yml"), "utf8")); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    return resolveHarnessPresetConfig(layers);
  }
  private async assertDependency(profile: string, bundle: string, path: string, allowMissing: boolean): Promise<void> {
    const dependency = await this.dependency(profile, bundle);
    if (dependency === undefined && allowMissing) return;
    if (typeof dependency !== "string" || !/^(?:file|link):/.test(dependency)
      || resolve(dshHome, "profiles", profile, dependency.slice(dependency.indexOf(":") + 1)) !== path) {
      throw new Error(`Harness bundle '${bundle}' has another owner in profile '${profile}'.`);
    }
  }
  private async run(args: string[]): Promise<void> {
    const cliScript = process.argv[1]?.replaceAll("\\", "/").includes("/@deepseek-ai/dsh/lib/bin.js") ? process.argv[1] : undefined;
    const version = await this.execute(cliScript, ["--version"]);
    if (version.trim() !== testedHarnessVersion) throw new Error(`DeepSeek Harness ${testedHarnessVersion} is required.`);
    await this.execute(cliScript, args);
  }
  private async execute(cliScript: string | undefined, args: string[]): Promise<string> {
    return new Promise<string>((resolveRun, rejectRun) => {
      const windows = process.platform === "win32";
      const script = "$dshArgs = @(ConvertFrom-Json $env:AI_MARKETPLACE_DSH_ARGUMENTS); & dsh @dshArgs; exit $LASTEXITCODE";
      const child = spawn(cliScript ? process.execPath : windows ? "powershell.exe" : "dsh", cliScript
        ? [cliScript, ...args]
        : windows ? ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")]
          : args, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"], env: windows && !cliScript
          ? { ...process.env, AI_MARKETPLACE_DSH_ARGUMENTS: JSON.stringify(args) } : process.env });
      let output = "";
      child.stdout.on("data", (chunk: Buffer) => { output = `${output}${chunk.toString("utf8")}`.slice(-1024); });
      child.once("error", rejectRun);
      child.once("close", (code) => code === 0 ? resolveRun(output) : rejectRun(new Error(`dsh plugin exited with code ${code}.`)));
    });
  }
}

function collectRules(cwd: string | undefined): string {
  const profileIndex = process.argv.indexOf("--profile");
  const profile = profileIndex >= 0 && profileName.test(process.argv[profileIndex + 1] ?? "") ? process.argv[profileIndex + 1] : "web";
  const roots = [{ path: join(dshHome, "rules"), scope: "global", state: join(userHome, ".ai_marketplace", "installed.json") }];
  if (cwd) roots.push({ path: join(resolve(cwd), ".dsh", "rules"), scope: "workspace", state: join(resolve(cwd), ".ai_marketplace", "installed.json") });
  const sections: string[] = [];
  for (const root of roots) {
    if (!isDirectory(root.path)) continue;
    const managed = managedRuleIds(root.state, root.scope, profile);
    for (const id of readdirSync(root.path).sort()) {
      if (!profileName.test(id)) continue;
      if (!managed.has(id)) continue;
      const path = join(root.path, id, "RULE.md");
      if (!isFile(path)) continue;
      sections.push(`## ${id}\n${readFileSync(path, "utf8")}`);
    }
  }
  return sections.length ? `# AI Marketplace rules\n\n${sections.join("\n\n")}`.slice(0, 65_536) : "";
}
function managedRuleIds(statePath: string, scope: string, profile: string): Set<string> {
  if (!isFile(statePath)) return new Set();
  try {
    const state: unknown = JSON.parse(readFileSync(statePath, "utf8"));
    if (!state || typeof state !== "object" || !Array.isArray((state as { packages?: unknown }).packages)) return new Set();
    return new Set((state as { packages: unknown[] }).packages.filter((item): item is { id: string } => Boolean(item)
      && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
      && (item as { platform?: unknown }).platform === "deepseek-harness"
      && (item as { type?: unknown }).type === "rule" && (item as { scope?: unknown }).scope === scope
      && (item as { harnessProfile?: unknown }).harnessProfile === profile
      && (item as { installedPath?: unknown }).installedPath === `.dsh/rules/${(item as { id: string }).id}`)
      .map((item) => item.id));
  } catch { return new Set(); }
}
function isDirectory(path: string): boolean { try { return lstatSync(path).isDirectory(); } catch { return false; } }
function isFile(path: string): boolean { try { return lstatSync(path).isFile(); } catch { return false; } }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
