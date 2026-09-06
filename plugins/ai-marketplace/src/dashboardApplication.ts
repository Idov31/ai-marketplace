import { randomBytes } from "node:crypto";
import {
  autoInstallGroupPlans,
  buildDashboardDetail,
  buildDashboardModel,
  dashboardFingerprints,
  defaultPackageInstallPlans,
  installRelativePath,
  isUpdateAvailable,
  mcpConfigRelativePath,
  mcpPayloadRelativePath,
  offloadRelativePath,
  packageIdentity,
  planPackageMigrations,
  stateRelativePath,
  uninstallTargetPaths,
  type DashboardAffectedPath,
  type DashboardApplyResult,
  type DashboardConfigurationPlanItem,
  type DashboardConfigurationFieldChange,
  type DashboardDetail,
  type DashboardDetailQuery,
  type DashboardFingerprints,
  type DashboardIneligibleItem,
  type DashboardLifecycleAction,
  type DashboardModel,
  type DashboardModelInput,
  type DashboardPackagePlanItem,
  type DashboardPlan,
  type DashboardPlanRequest,
  type DashboardPreferences,
  type DashboardQuery,
  type DashboardRefreshStatus,
  type DashboardScope,
  type InstalledPackage,
  type MarketplaceConfig,
  type MarketplacePackage,
  type MarketplaceService
} from "@ai-marketplace/core";

export interface DashboardConfigurationState {
  readonly configured: boolean;
  readonly preferences: DashboardPreferences;
  readonly revision: string;
}

export interface DashboardConfigurationChange {
  readonly identity: string;
  readonly summary: string;
  readonly changes: readonly DashboardConfigurationFieldChange[];
  readonly nextValue: unknown;
}

export interface DashboardConfigurationAdapter {
  read(): Promise<DashboardConfigurationState>;
  plan(request: Extract<DashboardPlanRequest, { readonly action: "set-preferences" | "source-add" | "source-update" | "source-remove" }>): Promise<DashboardConfigurationChange>;
  apply(nextValue: unknown): Promise<void>;
}

export interface DashboardCatalogRefreshResult {
  readonly packages: readonly MarketplacePackage[];
  readonly warnings: readonly string[];
}

export interface DashboardApplicationDependencies {
  readonly service: MarketplaceService;
  readonly marketplaceConfig: () => MarketplaceConfig;
  readonly configuration: DashboardConfigurationAdapter;
  readonly refreshCatalog: () => Promise<DashboardCatalogRefreshResult>;
  readonly withOperationLock: <T>(roots: readonly DashboardScope[], action: () => Promise<T>) => Promise<T>;
  readonly diagnose?: () => Promise<Readonly<Record<string, unknown>>>;
  readonly now?: () => Date;
  readonly planId?: () => string;
}

export type DashboardEvent =
  | { readonly event: "catalog"; readonly data: DashboardRefreshStatus }
  | { readonly event: "state"; readonly data: { readonly reason: "apply"; readonly planId: string } }
  | { readonly event: "operation"; readonly data: { readonly planId: string; readonly status: "applying" | "applied" | "rejected" } };

interface StoredPackageOperation {
  readonly item: DashboardPackagePlanItem;
  readonly pkg?: MarketplacePackage;
  readonly installed?: InstalledPackage;
  readonly revision?: string;
}

interface StoredPlan {
  readonly dto: DashboardPlan;
  readonly configurationRevision: string;
  readonly operations: readonly StoredPackageOperation[];
  readonly configurationValue?: unknown;
}

const planLifetimeMs = 5 * 60 * 1000;
const maximumPlanIdentities = 100;

export class DashboardApplicationError extends Error {
  public constructor(
    public readonly code: "VALIDATION" | "NOT_FOUND" | "STALE_PLAN" | "EXPIRED_PLAN" | "INELIGIBLE",
    message: string
  ) { super(message); }
}

export class DashboardApplication {
  private refreshStatus: DashboardRefreshStatus = { state: "offline", warnings: ["Catalog has not been refreshed in this dashboard session."] };
  private readonly plans = new Map<string, StoredPlan>();
  private readonly listeners = new Set<(event: DashboardEvent) => void>();

  public constructor(private readonly dependencies: DashboardApplicationDependencies) {}

  public subscribe(listener: (event: DashboardEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async getModel(query?: DashboardQuery): Promise<DashboardModel> {
    return buildDashboardModel({ ...(await this.modelInput()), query });
  }

  public async getDetail(identity: string, query: DashboardDetailQuery): Promise<DashboardDetail> {
    const detail = buildDashboardDetail(await this.modelInput(), identity, query);
    if (!detail) throw new DashboardApplicationError("NOT_FOUND", `Package '${identity}' was not found.`);
    return detail;
  }

  public async refresh(): Promise<DashboardModel> {
    const refreshedAt = this.now().toISOString();
    try {
      const result = await this.dependencies.refreshCatalog();
      this.refreshStatus = {
        state: result.warnings.length > 0 ? "partial" : "online",
        refreshedAt,
        warnings: redactWarnings(result.warnings)
      };
    } catch (error) {
      this.refreshStatus = { state: "offline", refreshedAt, warnings: [redactSensitive(safeMessage(error))] };
    }
    this.emit({ event: "catalog", data: this.refreshStatus });
    return this.getModel();
  }

  public async diagnose(): Promise<Readonly<Record<string, unknown>>> {
    const result = this.dependencies.diagnose ? await this.dependencies.diagnose() : await this.dependencies.service.diagnose();
    return { ...result, refresh: this.refreshStatus };
  }

  public async createPlan(request: DashboardPlanRequest): Promise<DashboardPlan> {
    this.pruneExpiredPlans();
    const input = await this.modelInput();
    const fingerprints = dashboardFingerprints(input.catalog, input.installed, input.preferences);
    const configurationState = await this.dependencies.configuration.read();
    const createdAt = this.now();
    const planId = this.dependencies.planId?.() ?? randomBytes(18).toString("base64url");
    const base = { schemaVersion: 1 as const, planId, createdAt: createdAt.toISOString(), expiresAt: new Date(createdAt.getTime() + planLifetimeMs).toISOString(), action: request.action, fingerprints };
    if (isConfigurationRequest(request)) {
      const change = await this.dependencies.configuration.plan(request);
      const item: DashboardConfigurationPlanItem = {
        kind: "configuration",
        identity: change.identity,
        action: request.action,
        summary: change.summary,
        changes: change.changes,
        paths: [{ scope: "global", path: ".ai_marketplace/codex.json", effect: "config" }]
      };
      const dto: DashboardPlan = { ...base, destructive: request.action === "source-remove", items: [item], skipped: [], ineligible: [] };
      this.plans.set(planId, { dto, configurationRevision: configurationState.revision, operations: [], configurationValue: change.nextValue });
      return dto;
    }

    const selection = await this.selectPackageOperations(request, input);
    const dto: DashboardPlan = {
      ...base,
      destructive: request.action === "uninstall" || request.action === "revert" || request.action === "migrate" || request.action === "sync"
        || selection.operations.some((operation) => operation.pkg?.manifest.type === "mcp" || operation.installed?.type === "mcp"),
      items: selection.operations.map((operation) => operation.item),
      skipped: selection.skipped,
      ineligible: selection.ineligible
    };
    this.plans.set(planId, { dto, configurationRevision: configurationState.revision, operations: selection.operations });
    return dto;
  }

  public async applyPlan(planId: string): Promise<DashboardApplyResult> {
    this.pruneExpiredPlans();
    const stored = this.plans.get(planId);
    if (!stored) throw new DashboardApplicationError("EXPIRED_PLAN", "The dashboard plan is missing or expired; create a new plan.");
    if (stored.dto.ineligible.length > 0 || stored.dto.items.length === 0) {
      this.plans.delete(planId);
      this.emit({ event: "operation", data: { planId, status: "rejected" } });
      throw new DashboardApplicationError("INELIGIBLE", "The plan contains no fully eligible operation to apply.");
    }
    this.emit({ event: "operation", data: { planId, status: "applying" } });
    const roots = [...new Set(stored.dto.items.flatMap((item) => item.paths.map((path) => path.scope)))];
    const failures: DashboardIneligibleItem[] = [];
    try {
      await this.dependencies.withOperationLock(roots, async () => {
        const configuration = await this.dependencies.configuration.read();
        const input = await this.modelInput();
        const current = dashboardFingerprints(input.catalog, input.installed, input.preferences);
        if (Date.parse(stored.dto.expiresAt) <= this.now().getTime()) throw new DashboardApplicationError("EXPIRED_PLAN", "The dashboard plan expired while waiting for the operation lock; replan before applying.");
        if (stored.configurationRevision !== configuration.revision || !sameFingerprints(stored.dto.fingerprints, current)) throw new DashboardApplicationError("STALE_PLAN", "Catalog, installed state, or configuration changed; replan before applying.");
        if (stored.configurationValue !== undefined) {
          await this.dependencies.configuration.apply(stored.configurationValue);
          return;
        }
        for (const operation of stored.operations) {
          try { await this.applyPackageOperation(operation); }
          catch (error) {
            if (operation.item.action !== "migrate") throw error;
            failures.push({ identity: operation.item.identity, reason: safeMessage(error) });
          }
        }
      });
    } catch (error) {
      // An apply may have completed one or more independently atomic package
      // mutations before a later item failed. Never allow that exact plan to be
      // replayed against the now-uncertain state.
      this.plans.delete(planId);
      this.emit({ event: "operation", data: { planId, status: "rejected" } });
      throw error;
    }
    this.plans.delete(planId);
    const nextInput = await this.modelInput();
    const fingerprints = dashboardFingerprints(nextInput.catalog, nextInput.installed, nextInput.preferences);
    this.emit({ event: "operation", data: { planId, status: "applied" } });
    this.emit({ event: "state", data: { reason: "apply", planId } });
    return { planId, applied: true, count: stored.dto.items.length - failures.length, fingerprints, ...(failures.length === 0 ? {} : { failures }) };
  }

  private async modelInput(): Promise<DashboardModelInput> {
    const configuration = await this.dependencies.configuration.read();
    return {
      catalog: this.dependencies.service.getCatalog(),
      installed: await this.dependencies.service.listInstalled(),
      configured: configuration.configured,
      preferences: configuration.preferences,
      refresh: this.refreshStatus
    };
  }

  private async selectPackageOperations(request: Exclude<DashboardPlanRequest, { readonly action: "set-preferences" | "source-add" | "source-update" | "source-remove" }>, input: DashboardModelInput): Promise<{ operations: readonly StoredPackageOperation[]; skipped: readonly DashboardIneligibleItem[]; ineligible: readonly DashboardIneligibleItem[] }> {
    if (request.action === "install-group") {
      const plans = await this.dependencies.service.planGroup(request.group, request.scope);
      const operations = plans.filter((plan) => plan.platform === "codex").map((plan) => this.installOperation(plan.pkg, plan.pkg.manifest.type === "mcp" ? "global" : request.scope));
      return { operations, skipped: [], ineligible: operations.length === 0 ? [{ identity: `group:${request.group}`, reason: "No eligible Codex packages remain in this group and scope." }] : [] };
    }
    if (request.action === "sync") return this.syncOperations(request.scope, input);
    const identities = uniqueIdentities(request.identities);
    const operations: StoredPackageOperation[] = [];
    const ineligible: DashboardIneligibleItem[] = [];
    for (const identity of identities) {
      try { operations.push(this.lifecycleOperation(request.action, identity, request.scope, input)); }
      catch (error) { ineligible.push({ identity, reason: safeMessage(error) }); }
    }
    return { operations, skipped: [], ineligible };
  }

  private syncOperations(scope: DashboardScope | undefined, input: DashboardModelInput): { operations: readonly StoredPackageOperation[]; skipped: readonly DashboardIneligibleItem[]; ineligible: readonly DashboardIneligibleItem[] } {
    const allInstalled = input.installed.filter(isCodexInstalled);
    const installed = allInstalled.filter((item) => !scope || item.scope === scope);
    const catalog = input.catalog.filter(isCodexPackage);
    const config = this.dependencies.marketplaceConfig();
    const installs = scope === "workspace" ? [] : [
      ...defaultPackageInstallPlans(catalog, allInstalled, "codex", config).filter((item) => item.platform === "codex"),
      ...autoInstallGroupPlans(catalog, allInstalled, input.preferences.autoInstallGroups, "codex").filter((item) => item.platform === "codex")
    ];
    const operations = new Map<string, StoredPackageOperation>();
    installs.forEach(({ pkg }) => operations.set(packageIdentity(pkg), this.installOperation(pkg, "global")));
    if (input.preferences.autoUpdate) {
      for (const current of installed) {
        if (current.autoUpdate === false) continue;
        const pkg = catalog.find((candidate) => sameIdentity(candidate, current));
        if (pkg && isUpdateAvailable(current.version, pkg.manifest.version)) {
          operations.set(`${packageIdentity(pkg)}:${current.scope}`, this.updateOperation(pkg, current));
        }
      }
    }
    return { operations: [...operations.values()], skipped: [], ineligible: [] };
  }

  private lifecycleOperation(action: DashboardLifecycleAction, identity: string, requestedScope: DashboardScope | undefined, input: DashboardModelInput): StoredPackageOperation {
    const pkg = input.catalog.find((candidate) => packageIdentity(candidate) === identity && isCodexPackage(candidate));
    const installedMatches = input.installed.filter((candidate) => installedDashboardIdentity(candidate) === identity && isCodexInstalled(candidate) && (!requestedScope || candidate.scope === requestedScope));
    if (action === "migrate") {
      const candidates = planPackageMigrations(input.catalog.filter(isCodexPackage), input.installed.filter(isCodexInstalled)).eligible.filter((candidate) =>
        (!requestedScope || candidate.predecessor.scope === requestedScope)
        && (packageIdentity(candidate.destination) === identity || installedDashboardIdentity(candidate.predecessor) === identity));
      if (candidates.length !== 1) throw new DashboardApplicationError(candidates.length === 0 ? "INELIGIBLE" : "VALIDATION", candidates.length === 0 ? "No eligible migration was found." : "Migration is ambiguous; choose a scope or a single package.");
      return this.migrationOperation(candidates[0].destination, candidates[0].predecessor);
    }
    if (action === "install") {
      if (!pkg) throw new DashboardApplicationError("NOT_FOUND", "Catalog package was not found.");
      const scope = pkg.manifest.type === "mcp" ? "global" : chooseInstallScope(pkg, requestedScope);
      if (installedMatches.some((item) => item.scope === scope)) throw new DashboardApplicationError("INELIGIBLE", `Package is already installed in ${scope} scope.`);
      return this.installOperation(pkg, scope);
    }
    if (installedMatches.length !== 1) throw new DashboardApplicationError(installedMatches.length === 0 ? "NOT_FOUND" : "VALIDATION", installedMatches.length === 0 ? "Installed package was not found in the requested scope." : "Installed identity is ambiguous; choose workspace or global scope.");
    const installed = installedMatches[0];
    if (action === "uninstall") return this.uninstallOperation(installed);
    if (action === "hotload" || action === "offload") return this.moveOperation(action, installed);
    if (!pkg) throw new DashboardApplicationError("NOT_FOUND", "Matching catalog package is required for this operation.");
    if (action === "update") {
      if (!isUpdateAvailable(installed.version, pkg.manifest.version) && !(installed.autoUpdate === false && installed.revertedAt !== undefined)) throw new DashboardApplicationError("INELIGIBLE", "Package is already current.");
      return this.updateOperation(pkg, installed);
    }
    const revision = pkg.manifest.previousVersion;
    if (!revision) throw new DashboardApplicationError("INELIGIBLE", "Package does not declare a previous version.");
    if (installed.version !== pkg.manifest.version) throw new DashboardApplicationError("INELIGIBLE", "Update to the current catalog version before reverting.");
    return { item: packagePlanItem(action, pkg, installed.scope as DashboardScope, pathsForMutation(action, pkg, installed, this.dependencies.marketplaceConfig()), installed.version, undefined), pkg, installed, revision };
  }

  private installOperation(pkg: MarketplacePackage, scope: DashboardScope): StoredPackageOperation {
    return { item: packagePlanItem("install", pkg, scope, pathsForMutation("install", pkg, undefined, this.dependencies.marketplaceConfig(), scope), undefined, pkg.manifest.version), pkg };
  }

  private updateOperation(pkg: MarketplacePackage, installed: InstalledPackage): StoredPackageOperation {
    return { item: packagePlanItem("update", pkg, installed.scope as DashboardScope, pathsForMutation("update", pkg, installed, this.dependencies.marketplaceConfig()), installed.version, pkg.manifest.version), pkg, installed };
  }

  private migrationOperation(pkg: MarketplacePackage, installed: InstalledPackage): StoredPackageOperation {
    return { item: packagePlanItem("migrate", pkg, installed.scope as DashboardScope, pathsForMutation("migrate", pkg, installed, this.dependencies.marketplaceConfig()), installed.version, pkg.manifest.version), pkg, installed };
  }

  private uninstallOperation(installed: InstalledPackage): StoredPackageOperation {
    return { item: installedPlanItem("uninstall", installed, pathsForMutation("uninstall", undefined, installed, this.dependencies.marketplaceConfig())), installed };
  }

  private moveOperation(action: "hotload" | "offload", installed: InstalledPackage): StoredPackageOperation {
    const offloaded = installed.installedPath === offloadRelativePath("codex", installed.type, installed.id);
    if (installed.type === "mcp") throw new DashboardApplicationError("INELIGIBLE", "MCP packages cannot be hotloaded or offloaded.");
    if ((action === "hotload") !== offloaded) throw new DashboardApplicationError("INELIGIBLE", `Package is already ${offloaded ? "offloaded" : "hotloaded"}.`);
    return { item: installedPlanItem(action, installed, pathsForMutation(action, undefined, installed, this.dependencies.marketplaceConfig())), installed };
  }

  private async applyPackageOperation(operation: StoredPackageOperation): Promise<void> {
    switch (operation.item.action) {
      case "install": await this.dependencies.service.install(operation.pkg!, "codex", operation.item.scope); break;
      case "update": await this.dependencies.service.update(operation.pkg!, operation.installed!); break;
      case "migrate": await this.dependencies.service.migrate(operation.pkg!, operation.installed!); break;
      case "revert": await this.dependencies.service.revert(operation.pkg!, operation.installed!, operation.revision!); break;
      case "uninstall": await this.dependencies.service.uninstall(operation.installed!); break;
      case "hotload": await this.dependencies.service.hotload(operation.installed!); break;
      case "offload": await this.dependencies.service.offload(operation.installed!); break;
    }
  }

  private pruneExpiredPlans(): void {
    const now = this.now().getTime();
    for (const [id, plan] of this.plans) if (Date.parse(plan.dto.expiresAt) <= now) this.plans.delete(id);
  }

  private now(): Date { return this.dependencies.now?.() ?? new Date(); }
  private emit(event: DashboardEvent): void { this.listeners.forEach((listener) => listener(event)); }
}

function isConfigurationRequest(request: DashboardPlanRequest): request is Extract<DashboardPlanRequest, { readonly action: "set-preferences" | "source-add" | "source-update" | "source-remove" }> {
  return request.action === "set-preferences" || request.action === "source-add" || request.action === "source-update" || request.action === "source-remove";
}

function uniqueIdentities(values: readonly string[]): readonly string[] {
  const identities = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (identities.length === 0 || identities.length > maximumPlanIdentities || identities.some((identity) => !identity.includes(":"))) throw new DashboardApplicationError("VALIDATION", "Provide 1-100 source-qualified package identities.");
  return identities;
}

function packagePlanItem(action: DashboardLifecycleAction, pkg: MarketplacePackage, scope: DashboardScope, paths: readonly DashboardAffectedPath[], version?: string, targetVersion?: string): DashboardPackagePlanItem {
  return { kind: "package", identity: packageIdentity(pkg), packageId: pkg.manifest.id, qualifiedName: pkg.manifest.qualifiedName, sourceId: pkg.source.id, action, platform: "codex", scope, version, targetVersion, paths };
}

function installedPlanItem(action: DashboardLifecycleAction, installed: InstalledPackage, paths: readonly DashboardAffectedPath[]): DashboardPackagePlanItem {
  return { kind: "package", identity: installedDashboardIdentity(installed), packageId: installed.id, qualifiedName: installed.qualifiedName ?? installed.id, sourceId: installed.sourceId ?? "legacy", action, platform: "codex", scope: installed.scope as DashboardScope, version: installed.version, paths };
}

function pathsForMutation(action: DashboardLifecycleAction, pkg: MarketplacePackage | undefined, installed: InstalledPackage | undefined, config: MarketplaceConfig, requestedScope?: DashboardScope): readonly DashboardAffectedPath[] {
  const scope = (pkg?.manifest.type === "mcp" ? "global" : requestedScope ?? installed?.scope ?? "workspace") as DashboardScope;
  const state: DashboardAffectedPath = { scope, path: stateRelativePath(), effect: "state" };
  if (pkg?.manifest.type === "mcp" || installed?.type === "mcp") {
    const destinationPayload = pkg ? mcpPayloadRelativePath("codex", pkg.source.id, pkg.manifest.id) : installed?.managedPayloadPath;
    const paths: DashboardAffectedPath[] = [{ scope: "global", path: mcpConfigRelativePath("codex"), effect: "config" }];
    if (action === "uninstall") {
      if (installed?.managedPayloadPath) paths.push({ scope: "global", path: `${installed.managedPayloadPath}/uninstall.py`, effect: "execute" }, { scope: "global", path: installed.managedPayloadPath, effect: "delete" });
    } else if (action === "migrate") {
      if (installed?.managedPayloadPath) paths.push({ scope: "global", path: `${installed.managedPayloadPath}/uninstall.py`, effect: "execute" });
      if (destinationPayload) paths.push({ scope: "global", path: destinationPayload, effect: "write" }, { scope: "global", path: `${destinationPayload}/install.py`, effect: "execute" });
    } else if (destinationPayload) {
      paths.push({ scope: "global", path: destinationPayload, effect: "write" }, { scope: "global", path: `${destinationPayload}/install.py`, effect: "execute" });
    }
    paths.push({ scope: "global", path: stateRelativePath(), effect: "state" });
    return paths;
  }
  if (action === "install") return [{ scope, path: installRelativePath("codex", pkg!.manifest.type, pkg!.manifest.id, config.platformPathOverrides), effect: "write" }, state];
  if (action === "uninstall") return [...uninstallTargetPaths(installed!, config).map((path): DashboardAffectedPath => ({ scope, path, effect: "delete" })), state];
  if (action === "migrate") {
    const target = installed!.installedPath.startsWith(".offload/")
      ? offloadRelativePath("codex", pkg!.manifest.type, pkg!.manifest.id)
      : installRelativePath("codex", pkg!.manifest.type, pkg!.manifest.id, config.platformPathOverrides);
    return [{ scope, path: installed!.installedPath, effect: "move-from" }, { scope, path: target, effect: "write" }, { scope, path: ".ai_marketplace/migration-journal.json", effect: "state" }, state];
  }
  if (action === "hotload" || action === "offload") {
    const destination = action === "hotload" ? installRelativePath("codex", installed!.type, installed!.id, config.platformPathOverrides) : offloadRelativePath("codex", installed!.type, installed!.id);
    return [{ scope, path: installed!.installedPath, effect: "move-from" }, { scope, path: destination, effect: "move-to" }, state];
  }
  return [{ scope, path: installed!.installedPath, effect: "write" }, state];
}

function chooseInstallScope(pkg: MarketplacePackage, requested: DashboardScope | undefined): DashboardScope {
  if (requested) {
    if (!pkg.manifest.delivery.includes(requested)) throw new DashboardApplicationError("INELIGIBLE", `Package does not support ${requested} scope.`);
    return requested;
  }
  if (pkg.manifest.delivery.includes("workspace")) return "workspace";
  if (pkg.manifest.delivery.includes("global")) return "global";
  throw new DashboardApplicationError("INELIGIBLE", "Package has no Codex local delivery scope.");
}

function isCodexPackage(pkg: MarketplacePackage): boolean { return pkg.manifest.platforms.includes("codex") && (pkg.manifest.delivery.includes("workspace") || pkg.manifest.delivery.includes("global")); }
function isCodexInstalled(item: InstalledPackage): item is InstalledPackage & { readonly scope: DashboardScope } { return item.platform === "codex" && (item.scope === "workspace" || item.scope === "global"); }
function sameIdentity(pkg: MarketplacePackage, installed: InstalledPackage): boolean { return installedDashboardIdentity(installed) === packageIdentity(pkg); }
function installedDashboardIdentity(installed: InstalledPackage): string { return `${installed.sourceId ?? "legacy"}:${installed.qualifiedName ?? installed.id}`; }
function sameFingerprints(left: DashboardFingerprints, right: DashboardFingerprints): boolean { return left.catalog === right.catalog && left.state === right.state; }
function redactWarnings(warnings: readonly string[]): readonly string[] { return warnings.map(redactSensitive); }
function redactSensitive(value: string): string { return value.replace(/(?:ghp|github_pat|glpat|azdopat)_[A-Za-z0-9_-]+/gi, "[REDACTED]"); }
function safeMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
