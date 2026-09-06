import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import {
  InstalledStateStore,
  MarketplaceService,
  defaultPackageInstallPlans,
  installOptionsForPackage,
  isUpdateAvailable,
  installRelativePath,
  mcpPayloadRelativePath,
  offloadRelativePath,
  packageIdentity,
  planPackageMigrations,
  packageTypes,
  type InstallScope,
  type InstalledPackage,
  type MarketplacePackage,
  type PackageType,
  type RepositoryProvider,
  uninstallTargetPaths
} from "@ai-marketplace/core";
import { type MarketplaceCliConfigFile, type MarketplaceCliHostPolicy, type MarketplaceCliRepository, hostConfigRelativePath, readHostConfig, toMarketplaceConfig, writeHostConfig } from "./config.js";
import { NodeMarketplaceStorage, SecurityError, withOperationLock } from "./nodeStorage.js";
import { NodeMcpScriptRunner } from "./mcpScriptRunner.js";
import { createEnvironmentCredentialProvider, credentialSourceSummary, redactCredentials } from "./credentials.js";


export interface CliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly env: NodeJS.ProcessEnv;
  readonly home: string;
}

export interface MarketplaceCliCommandContext {
  readonly workspace: string;
  readonly home: string;
  readonly env: NodeJS.ProcessEnv;
  readonly storage: NodeMarketplaceStorage;
}

export type MarketplaceCliCommandHandler = (
  parsed: { readonly action?: string; readonly values: readonly string[]; readonly flags: Readonly<Record<string, string | boolean>> },
  context: MarketplaceCliCommandContext
) => Promise<Record<string, unknown>>;

export interface MarketplaceCliOptions {
  readonly commands?: Readonly<Record<string, MarketplaceCliCommandHandler>>;
}

export async function runMarketplaceCli(
  argv: readonly string[],
  policy: MarketplaceCliHostPolicy,
  io: CliIo = defaultIo(),
  options: MarketplaceCliOptions = {}
): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    if (parsed.flags.platform !== undefined && parsed.flags.platform !== policy.platform) throw new CliError(2, `Only platform '${policy.platform}' is supported.`);
    const workspace = requiredWorkspace(parsed.flags.workspace);
    const storage = new NodeMarketplaceStorage(workspace, io.home);
    await storage.validateRoots();
    let rawConfig: MarketplaceCliConfigFile;
    try { rawConfig = await readHostConfig(storage, policy); } catch (error) { throw new CliError(error instanceof SecurityError ? 5 : 2, message(error), error instanceof SecurityError ? "FILESYSTEM_OR_SECURITY" : "VALIDATION"); }
    const config = validateMarketplaceConfig(rawConfig, policy);
    const logs: string[] = [];
    const service = new MarketplaceService({
      storage,
      configuration: { read: () => config },
      credentials: createEnvironmentCredentialProvider(io.env),
      logger: { log: (line) => logs.push(redactCredentials(line, io.env)) },
      mcpScriptRunner: new NodeMcpScriptRunner(storage)
    });
    const result = await dispatch(parsed, { service, storage, rawConfig, io, workspace, policy, commands: options.commands ?? {} });
    io.stdout(`${JSON.stringify({ ok: true, ...result, warnings: logs.filter((line) => /unable|failed|skipping/i.test(line)) })}\n`);
    return 0;
  } catch (error) {
    const classified = classify(error);
    io.stderr(`${classified.message}\n`);
    io.stdout(`${JSON.stringify({ ok: false, error: { code: classified.name, message: classified.message } })}\n`);
    return classified.exitCode;
  }
}

interface ParsedArgs { command: string; action?: string; values: readonly string[]; flags: Readonly<Record<string, string | boolean>>; }
interface Context { service: MarketplaceService; storage: NodeMarketplaceStorage; rawConfig: MarketplaceCliConfigFile; io: CliIo; workspace: string; policy: MarketplaceCliHostPolicy; commands: Readonly<Record<string, MarketplaceCliCommandHandler>>; }

async function dispatch(parsed: ParsedArgs, context: Context): Promise<Record<string, unknown>> {
  switch (parsed.command) {
    case "catalog": return catalogCommand(parsed, context);
    case "installed": return installedCommand(parsed, context);
    case "package": return packageCommand(parsed, context);
    case "bulk": return bulkCommand(parsed, context);
    case "group": return groupCommand(parsed, context);
    case "sync": return syncCommand(parsed, context);
    case "config": return configCommand(parsed, context);
    case "diagnose": return diagnoseCommand(context);
    default: {
      const handler = context.commands[parsed.command];
      if (handler) return handler(parsed, { workspace: context.workspace, home: context.io.home, env: context.io.env, storage: context.storage });
      throw new CliError(2, usage(context));
    }
  }
}

async function catalogCommand(parsed: ParsedArgs, context: Context): Promise<Record<string, unknown>> {
  if (!new Set(["list", "refresh"]).has(parsed.action ?? "")) throw new CliError(2, "Usage: catalog list|refresh");
  const catalog = hostCatalog(await context.service.refreshCatalog(), context.policy);
  const filtered = parsed.action === "list" ? filterCatalog(catalog, parsed.flags) : catalog;
  return { command: `catalog.${parsed.action}`, count: filtered.length, packages: filtered.map(publicPackage) };
}

async function installedCommand(parsed: ParsedArgs, context: Context): Promise<Record<string, unknown>> {
  if (parsed.action !== "list") throw new CliError(2, "Usage: installed list [--scope workspace|global]");
  const scope = optionalScope(parsed.flags.scope);
  const installed = (await context.service.listInstalled()).filter((item) => item.platform === context.policy.platform && (!scope || item.scope === scope));
  return { command: "installed.list", count: installed.length, packages: installed };
}

async function packageCommand(parsed: ParsedArgs, context: Context): Promise<Record<string, unknown>> {
  const actions = new Set(["install", "update", "migrate", "revert", "uninstall", "hotload", "offload"]);
  if (!parsed.action || !actions.has(parsed.action) || parsed.values.length !== 1) throw new CliError(2, "Usage: package install|update|migrate|revert|uninstall|hotload|offload PACKAGE");
  const scope = scopeFlag(parsed.flags.scope);
  const apply = parsed.flags.apply === true;
  const catalog = parsed.action === "uninstall" || parsed.action === "hotload" || parsed.action === "offload" ? [] : hostCatalog(await context.service.refreshCatalog(), context.policy);
  const installed = (await context.service.listInstalled()).filter((item) => item.platform === context.policy.platform);
  const pkg = catalog.length > 0 ? resolvePackage(catalog, parsed.values[0]) : undefined;
  let current: InstalledPackage | undefined;
  if (parsed.action === "migrate") {
    const from = stringFlag(parsed.flags.from);
    const migrationScope = pkg!.manifest.type === "mcp" ? "global" : scope;
    const candidates = planPackageMigrations(catalog, installed).eligible.filter((item) => packageIdentity(item.destination) === packageIdentity(pkg!)
      && item.predecessor.scope === migrationScope
      && (!from || installedSelectorMatches(item.predecessor, from)));
    if (candidates.length === 0) throw new CliError(3, `No eligible predecessor is installed for '${pkg!.manifest.qualifiedName}' in ${migrationScope} scope.`);
    if (candidates.length > 1) throw new CliError(3, `Migration is ambiguous; use --from sourceId:qualifiedName. Candidates: ${candidates.map((item) => installedIdentityText(item.predecessor)).join(", ")}`);
    current = candidates[0].predecessor;
  } else if (parsed.action !== "install") current = resolveInstalled(installed, parsed.values[0], scope);
  const effectiveScope = pkg?.manifest.type === "mcp" ? "global" : (current?.scope ?? scope);
  if (pkg && !pkg.manifest.delivery.includes(effectiveScope)) throw new CliError(2, `Package does not support ${effectiveScope} scope.`);
  const plan = {
    action: parsed.action,
    package: pkg ? publicPackage(pkg) : current,
    scope: effectiveScope,
    platform: context.policy.platform,
    paths: plannedPaths(parsed.action, pkg, current, toMarketplaceConfig(context.rawConfig, context.policy), context.policy),
    executions: plannedExecutions(parsed.action, pkg, current, context.policy)
  };
  const planId = fingerprintPlan(`package.${parsed.action}`, { host: context.policy.platform, plan, config: context.rawConfig, installed });
  if (!apply) return { command: `package.${parsed.action}`, applied: false, planId, plan };
  requirePlanId(parsed, planId);
  const result = await withOperationLock(context.storage, affectedRoots(effectiveScope, pkg?.manifest.type === "mcp"), async () => {
    await assertUnchanged(context, installed, catalog, undefined, catalog.length > 0);
    switch (parsed.action) {
      case "install": return context.service.install(pkg!, context.policy.platform, effectiveScope);
      case "update": return context.service.update(pkg!, current!);
      case "migrate": return context.service.migrate(pkg!, current!);
      case "revert": {
        const revision = pkg!.manifest.previousVersion;
        if (!revision) throw new CliError(2, "Package does not declare previous_version.");
        return context.service.revert(pkg!, current!, revision);
      }
      case "uninstall": await context.service.uninstall(current!); return current;
      case "hotload": return context.service.hotload(current!);
      case "offload": return context.service.offload(current!);
      default: throw new CliError(2, "Unsupported package action.");
    }
  });
  return { command: `package.${parsed.action}`, applied: true, planId, plan, result };
}

async function bulkCommand(parsed: ParsedArgs, context: Context): Promise<Record<string, unknown>> {
  const actions = new Set(["install", "update", "migrate", "uninstall", "hotload", "offload"]);
  if (!parsed.action || !actions.has(parsed.action)) throw new CliError(2, "Usage: bulk install|update|migrate|uninstall|hotload|offload");
  const scope = scopeFlag(parsed.flags.scope);
  const installed = (await context.service.listInstalled()).filter((item) => item.platform === context.policy.platform && item.scope === scope);
  const catalog = parsed.action === "uninstall" || parsed.action === "hotload" || parsed.action === "offload" ? [] : hostCatalog(await context.service.refreshCatalog(), context.policy);
  const group = stringFlag(parsed.flags.group);
  const selectedCatalog = catalog.filter((pkg) => (!group || pkg.manifest.group === group) && pkg.manifest.delivery.includes(pkg.manifest.type === "mcp" ? "global" : scope));
  let items: Array<{ pkg?: MarketplacePackage; installed?: InstalledPackage }>;
  if (parsed.action === "install") {
    const candidates = selectedCatalog.map((pkg) => ({
      selection: { packageId: pkg.manifest.id, sourceId: pkg.source.id, qualifiedName: pkg.manifest.qualifiedName, platform: context.policy.platform },
      options: installOptionsForPackage(pkg, installed.filter((item) => sameIdentity(pkg, item)), context.policy.platform).filter((option) => option.platform === context.policy.platform)
    }));
    const planned = context.service.planBulkInstall(candidates, scope);
    items = planned.eligible.flatMap(({ selection }) => {
      const pkg = selectedCatalog.find((candidate) => candidate.source.id === selection.sourceId && candidate.manifest.qualifiedName === selection.qualifiedName);
      return pkg ? [{ pkg }] : [];
    });
  } else if (parsed.action === "update") {
    items = installed.flatMap((item) => {
      const pkg = selectedCatalog.find((candidate) => sameIdentity(candidate, item));
      return pkg && isUpdateAvailable(item.version, pkg.manifest.version) ? [{ pkg, installed: item }] : [];
    });
  } else if (parsed.action === "migrate") {
    items = planPackageMigrations(selectedCatalog, installed).eligible.map((item) => ({ pkg: item.destination, installed: item.predecessor }));
  } else {
    const matching = installed.filter((item) => !group || item.group === group).filter((item) => parsed.action === "uninstall" || (parsed.action === "hotload" ? item.installedPath.startsWith(".offload/") : !item.installedPath.startsWith(".offload/")));
    if (parsed.action === "uninstall") {
      const planned = context.service.planBulkUninstall(matching.map((item) => ({ selection: { packageId: item.id, sourceId: item.sourceId, qualifiedName: item.qualifiedName, platform: context.policy.platform }, installed: matching })), scope);
      items = planned.eligible.map((item) => ({ installed: item }));
    } else {
      items = matching.map((item) => ({ installed: item }));
    }
  }
  const plan = items.map(({ pkg, installed: current }) => ({ action: parsed.action, package: pkg ? publicPackage(pkg) : current, scope: pkg?.manifest.type === "mcp" ? "global" : scope, paths: plannedPaths(parsed.action!, pkg, current, toMarketplaceConfig(context.rawConfig, context.policy), context.policy), executions: plannedExecutions(parsed.action!, pkg, current, context.policy) }));
  const planId = fingerprintPlan(`bulk.${parsed.action}`, { host: context.policy.platform, plan, config: context.rawConfig, installed });
  if (parsed.flags.apply !== true) return { command: `bulk.${parsed.action}`, applied: false, count: plan.length, planId, plan };
  requirePlanId(parsed, planId);
  const results = await withOperationLock(context.storage, affectedRoots(scope, items.some(({ pkg }) => pkg?.manifest.type === "mcp")), async () => {
    await assertUnchanged(context, installed, catalog, scope, catalog.length > 0);
    const output: unknown[] = [];
    for (const item of items) {
      if (parsed.action === "install") output.push(await context.service.install(item.pkg!, context.policy.platform, item.pkg!.manifest.type === "mcp" ? "global" : scope));
      else if (parsed.action === "update") output.push(await context.service.update(item.pkg!, item.installed!));
      else if (parsed.action === "migrate") {
        try { output.push(await context.service.migrate(item.pkg!, item.installed!)); }
        catch (error) { output.push({ package: item.installed!.qualifiedName ?? item.installed!.id, error: message(error) }); }
      }
      else if (parsed.action === "uninstall") { await context.service.uninstall(item.installed!); output.push(item.installed); }
      else if (parsed.action === "hotload") output.push(await context.service.hotload(item.installed!));
      else output.push(await context.service.offload(item.installed!));
    }
    return output;
  });
  return { command: `bulk.${parsed.action}`, applied: true, count: results.length, planId, plan, results };
}

async function groupCommand(parsed: ParsedArgs, context: Context): Promise<Record<string, unknown>> {
  if (parsed.action !== "install" || parsed.values.length !== 1) throw new CliError(2, "Usage: group install GROUP");
  const scope = scopeFlag(parsed.flags.scope);
  const catalog = hostCatalog(await context.service.refreshCatalog(), context.policy);
  const installed = (await context.service.listInstalled()).filter((item) => item.platform === context.policy.platform && item.scope === scope);
  const plans = (await context.service.planGroup(parsed.values[0], scope)).filter((plan) => plan.platform === context.policy.platform);
  const plan = plans.map((item) => ({ action: "install", package: publicPackage(item.pkg), scope: item.pkg.manifest.type === "mcp" ? "global" : scope, platform: context.policy.platform, executions: plannedExecutions("install", item.pkg, undefined, context.policy) }));
  const planId = fingerprintPlan("group.install", { host: context.policy.platform, plan, config: context.rawConfig, installed });
  if (parsed.flags.apply !== true) return { command: "group.install", applied: false, count: plan.length, planId, plan };
  requirePlanId(parsed, planId);
  const results = await withOperationLock(context.storage, affectedRoots(scope, plans.some(({ pkg }) => pkg.manifest.type === "mcp")), async () => {
    await assertUnchanged(context, installed, catalog, scope, true);
    const output = [];
    for (const item of plans) output.push(await context.service.install(item.pkg, context.policy.platform, item.pkg.manifest.type === "mcp" ? "global" : scope));
    return output;
  });
  return { command: "group.install", applied: true, count: results.length, planId, plan, results };
}

async function syncCommand(parsed: ParsedArgs, context: Context): Promise<Record<string, unknown>> {
  if (!new Set(["plan", "apply"]).has(parsed.action ?? "")) throw new CliError(2, "Usage: sync plan|apply");
  const scope = optionalScope(parsed.flags.scope);
  const catalog = hostCatalog(await context.service.refreshCatalog(), context.policy);
  const installed = (await context.service.listInstalled()).filter((item) => item.platform === context.policy.platform && (!scope || item.scope === scope));
  const config = toMarketplaceConfig(context.rawConfig, context.policy);
  const defaults = defaultPackageInstallPlans(catalog, installed, context.policy.platform, config).filter(({ platform }) => platform === context.policy.platform);
  const groups = (await Promise.all((context.rawConfig.autoInstallGroups ?? []).map((group) => context.service.planGroup(group, "global")))).flat().filter(({ platform }) => platform === context.policy.platform);
  const updates = context.rawConfig.autoUpdate === true ? installed.flatMap((current) => {
    const pkg = catalog.find((candidate) => sameIdentity(candidate, current));
    return pkg && isUpdateAvailable(current.version, pkg.manifest.version) ? [{ pkg, current }] : [];
  }) : [];
  const uniqueInstalls = [...new Map([...defaults.map(({ pkg }) => ({ pkg })), ...groups.map(({ pkg }) => ({ pkg }))].map((item) => [packageIdentity(item.pkg), item])).values()];
  const plan = [
    ...uniqueInstalls.map(({ pkg }) => ({ action: "install", package: publicPackage(pkg), scope: "global", platform: context.policy.platform, executions: plannedExecutions("install", pkg, undefined, context.policy) })),
    ...updates.map(({ pkg, current }) => ({ action: "update", package: publicPackage(pkg), installed: current, scope: current.scope, platform: context.policy.platform, executions: plannedExecutions("update", pkg, current, context.policy) }))
  ];
  const planId = fingerprintPlan("sync.apply", { host: context.policy.platform, plan, config: context.rawConfig, installed });
  if (parsed.action === "plan" || parsed.flags.apply !== true) return { command: `sync.${parsed.action}`, applied: false, count: plan.length, planId, plan };
  requirePlanId(parsed, planId);
  const results = await withOperationLock(context.storage, ["global", "workspace"], async () => {
    await assertUnchanged(context, installed, catalog, scope, true);
    return context.service.applySync({ actions: [
      ...uniqueInstalls.map(({ pkg }) => ({ kind: "install-group" as const, pkg, platform: context.policy.platform, scope: "global" as const })),
      ...updates.map(({ pkg, current }) => ({ kind: "update" as const, pkg, installed: current }))
    ] });
  });
  return { command: "sync.apply", applied: true, count: results.length, planId, plan, results };
}

async function configCommand(parsed: ParsedArgs, context: Context): Promise<Record<string, unknown>> {
  if (parsed.action === "show") return { command: "config.show", config: context.rawConfig, credentialSource: credentialSourceSummary(context.io.env, toMarketplaceConfig(context.rawConfig, context.policy).repositories ?? []) };
  const next = mutateConfig(parsed, context.rawConfig);
  validateMarketplaceConfig(next, context.policy);
  const plan = { action: `config.${parsed.action}`, path: `~/${hostConfigRelativePath(context.policy)}`, config: next };
  const planId = fingerprintPlan(`config.${parsed.action}`, { host: context.policy.platform, plan, previous: context.rawConfig });
  if (parsed.flags.apply !== true) return { command: `config.${parsed.action}`, applied: false, planId, plan };
  requirePlanId(parsed, planId);
  await withOperationLock(context.storage, ["global"], async () => {
    const latest = await readHostConfig(context.storage, context.policy);
    if (JSON.stringify(latest) !== JSON.stringify(context.rawConfig)) throw new CliError(3, "Configuration changed after this plan was created; review the new plan before applying.", "STALE_PLAN");
    await writeHostConfig(context.storage, context.policy, next);
  });
  return { command: `config.${parsed.action}`, applied: true, planId, plan };
}

async function diagnoseCommand(context: Context): Promise<Record<string, unknown>> {
  const catalog = hostCatalog(await context.service.refreshCatalog(), context.policy);
  return { command: "diagnose", workspace: context.storage.root("workspace"), global: context.storage.root("global"), credentialSource: credentialSourceSummary(context.io.env, toMarketplaceConfig(context.rawConfig, context.policy).repositories ?? []), catalogPackages: catalog.length, installedPackages: (await context.service.listInstalled()).filter((item) => item.platform === context.policy.platform).length };
}

function mutateConfig(parsed: ParsedArgs, raw: MarketplaceCliConfigFile): MarketplaceCliConfigFile {
  const [noun, verb, ...values] = [parsed.action, ...parsed.values];
  if (noun === "source" && new Set(["add", "update", "remove"]).has(verb ?? "")) {
    const id = values[0];
    if (!id) throw new CliError(2, "Repository id is required.");
    const repositories = [...(raw.repositories ?? [])];
    const index = repositories.findIndex((item) => item.id === id);
    if (verb === "remove") {
      if (index < 0) throw new CliError(3, `Repository '${id}' is not configured.`);
      repositories.splice(index, 1);
    } else {
      const url = stringFlag(parsed.flags.url) ?? values[1];
      if (!url) throw new CliError(2, "--url is required for source add/update.");
      const provider = stringFlag(parsed.flags.provider);
      const source: MarketplaceCliRepository = { ...(index >= 0 ? repositories[index] : {} as MarketplaceCliRepository), id, url, ...(provider ? { provider: provider as RepositoryProvider } : {}), label: stringFlag(parsed.flags.label), branch: stringFlag(parsed.flags.branch), enabled: booleanFlag(parsed.flags.enabled, true), allowDefaultPackages: booleanFlag(parsed.flags["allow-defaults"], false) };
      if (verb === "add" && index >= 0) throw new CliError(3, `Repository '${id}' already exists.`);
      if (verb === "update" && index < 0) throw new CliError(3, `Repository '${id}' is not configured.`);
      if (index < 0) repositories.push(source); else repositories[index] = source;
    }
    return { ...raw, repositories };
  }
  if (noun === "auto-groups" && verb === "set") return { ...raw, autoInstallGroups: [...new Set(values.map((item) => item.trim()).filter(Boolean))].sort() };
  if (noun === "auto-update" && verb === "set" && values.length === 1) return { ...raw, autoUpdate: parseBoolean(values[0]) };
  throw new CliError(2, "Usage: config show|source add|update|remove|auto-groups set|auto-update set");
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) { positionals.push(arg); continue; }
    const name = arg.slice(2);
    if (!name || name === "cloud") throw new CliError(2, `Unsupported option '${arg}'.`);
    if (name === "apply") { flags.apply = true; continue; }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new CliError(2, `Option '${arg}' requires a value.`);
    flags[name] = value;
    index += 1;
  }
  const [command = "", action, ...values] = positionals;
  return { command, action, values, flags };
}

function requiredWorkspace(value: string | boolean | undefined): string {
  if (typeof value !== "string" || !isAbsolute(value)) throw new CliError(2, "--workspace must be an explicit absolute path.");
  return resolve(value);
}
function scopeFlag(value: string | boolean | undefined): "workspace" | "global" { return optionalScope(value) ?? "workspace"; }
function optionalScope(value: string | boolean | undefined): "workspace" | "global" | undefined { if (value === undefined) return undefined; if (value === "workspace" || value === "global") return value; throw new CliError(2, "Scope must be 'workspace' or 'global'."); }
function stringFlag(value: string | boolean | undefined): string | undefined { return typeof value === "string" ? value : undefined; }
function booleanFlag(value: string | boolean | undefined, fallback: boolean): boolean { return value === undefined ? fallback : typeof value === "boolean" ? value : parseBoolean(value); }
function parseBoolean(value: string): boolean { if (value === "true") return true; if (value === "false") return false; throw new CliError(2, "Boolean value must be true or false."); }
function fingerprintPlan(command: string, plan: unknown): string { return createHash("sha256").update(JSON.stringify({ command, plan })).digest("hex"); }
function requirePlanId(parsed: ParsedArgs, expected: string): void { const supplied = stringFlag(parsed.flags["plan-id"]); if (!supplied) throw new CliError(2, "--apply requires the --plan-id returned by the reviewed dry-run.", "PLAN_REQUIRED"); if (supplied !== expected) throw new CliError(3, "The supplied plan ID does not match the current exact plan; review the new plan before applying.", "STALE_PLAN"); }

function hostCatalog(catalog: readonly MarketplacePackage[], policy: MarketplaceCliHostPolicy): MarketplacePackage[] { return catalog.filter((pkg) => pkg.manifest.platforms.includes(policy.platform) && (pkg.manifest.delivery.includes("workspace") || pkg.manifest.delivery.includes("global"))); }
function filterCatalog(catalog: readonly MarketplacePackage[], flags: Readonly<Record<string, string | boolean>>): MarketplacePackage[] {
  const search = stringFlag(flags.search)?.toLowerCase(); const type = stringFlag(flags.type); const group = stringFlag(flags.group);
  if (type && !packageTypes.includes(type as PackageType)) throw new CliError(2, `Unknown package type '${type}'.`);
  return catalog.filter((pkg) => (!type || pkg.manifest.type === type) && (!group || pkg.manifest.group === group) && (!search || [pkg.manifest.name, pkg.manifest.qualifiedName, pkg.manifest.description, ...pkg.manifest.tags].some((value) => value.toLowerCase().includes(search))));
}
function resolvePackage(catalog: readonly MarketplacePackage[], identity: string): MarketplacePackage { const matches = catalog.filter((pkg) => packageIdentity(pkg) === identity || pkg.manifest.qualifiedName === identity || pkg.manifest.id === identity); if (matches.length === 0) throw new CliError(3, `Package '${identity}' was not found.`); if (matches.length > 1) throw new CliError(3, `Package '${identity}' is ambiguous; use sourceId:qualifiedName. Candidates: ${matches.map(packageIdentity).join(", ")}`); return matches[0]; }
function resolveInstalled(installed: readonly InstalledPackage[], identity: string, scope: "workspace" | "global"): InstalledPackage { const matches = installed.filter((item) => item.scope === scope && (`${item.sourceId ?? "legacy"}:${item.qualifiedName ?? item.id}` === identity || item.qualifiedName === identity || item.id === identity)); if (matches.length === 0) throw new CliError(3, `Installed package '${identity}' was not found in ${scope} scope.`); if (matches.length > 1) throw new CliError(3, `Installed package '${identity}' is ambiguous; use sourceId:qualifiedName.`); return matches[0]; }
async function assertUnchanged(context: Context, installed: readonly InstalledPackage[], catalog: readonly MarketplacePackage[], scope?: "workspace" | "global", checkCatalog = true): Promise<void> {
  const latest = await readHostConfig(context.storage, context.policy);
  if (JSON.stringify(latest) !== JSON.stringify(context.rawConfig)) throw new CliError(3, "Configuration changed after this plan was created; review the new plan before applying.", "STALE_PLAN");
  const latestInstalled = (await context.service.listInstalled()).filter((item) => item.platform === context.policy.platform && (!scope || item.scope === scope));
  if (JSON.stringify(latestInstalled) !== JSON.stringify(installed)) throw new CliError(3, "Installed state changed after this plan was created; review the new plan before applying.", "STALE_PLAN");
  if (checkCatalog) {
    const latestCatalog = hostCatalog(await context.service.refreshCatalog(), context.policy);
    if (catalogFingerprint(latestCatalog) !== catalogFingerprint(catalog)) throw new CliError(3, "Catalog changed after this plan was created; review the new plan before applying.", "STALE_PLAN");
  }
}
function catalogFingerprint(catalog: readonly MarketplacePackage[]): string { return JSON.stringify(catalog.map((pkg) => [packageIdentity(pkg), pkg.sourceRevision, pkg.manifest.version, pkg.manifest.platforms, pkg.manifest.delivery, pkg.manifest.migrations])); }
function sameIdentity(pkg: MarketplacePackage, installed: InstalledPackage): boolean { return pkg.manifest.id === installed.id && (installed.sourceId === undefined || installed.sourceId === pkg.source.id) && (installed.qualifiedName === undefined || installed.qualifiedName === pkg.manifest.qualifiedName); }
function publicPackage(pkg: MarketplacePackage): Record<string, unknown> { return { identity: packageIdentity(pkg), id: pkg.manifest.id, qualifiedName: pkg.manifest.qualifiedName, name: pkg.manifest.name, group: pkg.manifest.group, type: pkg.manifest.type, version: pkg.manifest.version, description: pkg.manifest.description, delivery: pkg.manifest.delivery.filter((scope) => scope !== "cloud"), tags: pkg.manifest.tags, source: pkg.source, sourceRevision: pkg.sourceRevision, previousVersion: pkg.manifest.previousVersion, migrations: pkg.manifest.migrations, hotload: pkg.hotload }; }
function plannedPaths(action: string, pkg: MarketplacePackage | undefined, current: InstalledPackage | undefined, config: ReturnType<typeof toMarketplaceConfig>, policy: MarketplaceCliHostPolicy): readonly string[] {
  const state = ".ai_marketplace/installed.json";
  if (current?.type === "mcp" || pkg?.manifest.type === "mcp") {
    const destination = pkg ? mcpPayloadRelativePath(policy.platform, pkg.source.id, pkg.manifest.id) : undefined;
    return [...new Set([policy.mcpConfigRelativePath, current?.managedPayloadPath, destination, state].filter((value): value is string => value !== undefined))];
  }
  if (current) {
    const active = installRelativePath(policy.platform, current.type, current.id, config.platformPathOverrides);
    const offload = offloadRelativePath(policy.platform, current.type, current.id);
    if (action === "uninstall") return [...new Set([...uninstallTargetPaths(current, config), state])];
    if (action === "hotload") return [current.installedPath, active, state];
    if (action === "offload") return [current.installedPath, offload, state];
    if (action === "migrate" && pkg) {
      const target = current.installedPath.startsWith(".offload/") ? offloadRelativePath(policy.platform, pkg.manifest.type, pkg.manifest.id) : installRelativePath(policy.platform, pkg.manifest.type, pkg.manifest.id, config.platformPathOverrides);
      return [current.installedPath, target, ".ai_marketplace/migration-journal.json", state];
    }
    return [current.installedPath, state];
  }
  return pkg ? [installRelativePath(policy.platform, pkg.manifest.type, pkg.manifest.id, config.platformPathOverrides), state] : [];
}
function plannedExecutions(action: string, pkg: MarketplacePackage | undefined, current: InstalledPackage | undefined, policy: MarketplaceCliHostPolicy): readonly { readonly script: string; readonly action: string; readonly platform: MarketplaceCliHostPolicy["platform"] }[] {
  if (pkg?.manifest.type !== "mcp" && current?.type !== "mcp") return [];
  if (action === "uninstall") return current?.managedPayloadPath ? [{ script: `${current.managedPayloadPath}/uninstall.py`, action: "uninstall", platform: policy.platform }] : [];
  if (action === "migrate") return [
    ...(current?.managedPayloadPath ? [{ script: `${current.managedPayloadPath}/uninstall.py`, action: "migrate", platform: policy.platform }] : []),
    ...(pkg ? [{ script: `${mcpPayloadRelativePath(policy.platform, pkg.source.id, pkg.manifest.id)}/install.py`, action: "migrate", platform: policy.platform }] : [])
  ];
  const scriptAction = action === "revert" ? "revert" : action === "update" ? "update" : "install";
  return pkg ? [{ script: `${mcpPayloadRelativePath(policy.platform, pkg.source.id, pkg.manifest.id)}/install.py`, action: scriptAction, platform: policy.platform }] : [];
}
function installedIdentityText(item: InstalledPackage): string { return `${item.sourceId ?? "legacy"}:${item.qualifiedName ?? item.id}`; }
function installedSelectorMatches(item: InstalledPackage, selector: string): boolean { return installedIdentityText(item) === selector || item.qualifiedName === selector || item.id === selector; }
function affectedRoots(scope: InstallScope, includesGlobal: boolean): ("workspace" | "global")[] { if (scope === "cloud") throw new CliError(2, "Cloud scope is not supported."); return includesGlobal && scope === "workspace" ? ["workspace", "global"] : [scope]; }
function validateMarketplaceConfig(raw: MarketplaceCliConfigFile, policy: MarketplaceCliHostPolicy) { try { return toMarketplaceConfig(raw, policy); } catch (error) { throw new CliError(2, message(error)); } }

export class MarketplaceCliError extends Error { public constructor(public readonly exitCode: number, message: string, public readonly name = exitCode === 2 ? "VALIDATION" : exitCode === 3 ? "NOT_FOUND_OR_CONFLICT" : "ERROR") { super(message); } }
const CliError = MarketplaceCliError;
function classify(error: unknown): MarketplaceCliError {
  if (error instanceof CliError) return error;
  if (error instanceof SecurityError || isFsError(error)) return new CliError(5, filesystemErrorMessage(error), "FILESYSTEM_OR_SECURITY");
  const text = message(error);
  if (/401|403|authentication|rate limit|github request|fetch failed|network/i.test(text)) return new CliError(4, text, "NETWORK_OR_AUTH");
  return new CliError(1, text, "UNEXPECTED");
}
export function filesystemErrorMessage(error: unknown): string {
  const detail = message(error);
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
  return (code === "EPERM" || code === "EACCES") && /(?:^|[\\/])\.operation\.lock\b/i.test(detail)
    ? `${detail} Request host filesystem approval for this exact lock path and retry the unchanged approved plan; do not delete or bypass the lock.`
    : detail;
}
function isFsError(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string"; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function usage(context: Context): string { return `Usage: ai-marketplace <${[...Object.keys(context.commands), "catalog", "installed", "package", "bulk", "group", "sync", "config", "diagnose"].join("|")}> ... --workspace ABSOLUTE_PATH`; }
function defaultIo(): CliIo { return { stdout: (text) => process.stdout.write(text), stderr: (text) => process.stderr.write(text), env: process.env, home: homedir() }; }
