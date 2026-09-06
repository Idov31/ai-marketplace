import type {
  InstallScope,
  InstalledPackage,
  MarketplacePackage,
  PackageType,
  Platform,
  RepositoryProvider
} from "./types/packages";
import {
  installedIdentity,
  packageIdentity,
  toSerializableMarketplaceModel,
  type CardAction,
  type SerializableInstalledPackage,
  type SerializablePackage
} from "./services/marketplaceModel";
import { collectPackageGroups } from "./services/groupInstall";

export type DashboardScope = Extract<InstallScope, "workspace" | "global">;
export type DashboardTab = "available" | "installed" | "updates";
export type DashboardRefreshState = "online" | "partial" | "offline";
export type DashboardLifecycleAction = "install" | "update" | "migrate" | "revert" | "uninstall" | "hotload" | "offload";
export type DashboardOperationAction = DashboardLifecycleAction
  | "install-group"
  | "sync"
  | "set-preferences"
  | "source-add"
  | "source-update"
  | "source-remove";

export interface DashboardQuery {
  readonly tab?: DashboardTab;
  readonly search?: string;
  readonly type?: PackageType;
  readonly group?: string;
  readonly sourceId?: string;
  readonly scope?: DashboardScope;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface DashboardPreferences {
  readonly autoUpdate: boolean;
  readonly autoInstallGroups: readonly string[];
}

export interface DashboardRefreshStatus {
  readonly state: DashboardRefreshState;
  readonly refreshedAt?: string;
  readonly warnings: readonly string[];
}

export interface DashboardSourceFacet {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

export interface DashboardFacets {
  readonly types: readonly { readonly value: PackageType; readonly count: number }[];
  readonly groups: readonly { readonly value: string; readonly count: number }[];
  readonly sources: readonly DashboardSourceFacet[];
  readonly scopes: readonly { readonly value: DashboardScope; readonly count: number }[];
}

export interface DashboardAvailableRow extends SerializablePackage {
  readonly kind: "available";
}

export interface DashboardInstalledRow extends SerializableInstalledPackage {
  readonly kind: "installed";
}

export type DashboardRow = DashboardAvailableRow | DashboardInstalledRow;

export interface DashboardPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface DashboardFingerprints {
  readonly catalog: string;
  readonly state: string;
}

export interface DashboardModel {
  readonly schemaVersion: 1;
  readonly platform: "codex";
  readonly scopes: readonly DashboardScope[];
  readonly tab: DashboardTab;
  readonly configured: boolean;
  readonly preferences: DashboardPreferences;
  readonly refresh: DashboardRefreshStatus;
  readonly counts: {
    readonly available: number;
    readonly installed: number;
    readonly updates: number;
  };
  readonly knownGroups: readonly string[];
  readonly facets: DashboardFacets;
  readonly rows: readonly DashboardRow[];
  readonly pagination: DashboardPagination;
  readonly fingerprints: DashboardFingerprints;
}

export interface DashboardModelInput {
  readonly catalog: readonly MarketplacePackage[];
  readonly installed: readonly InstalledPackage[];
  readonly configured: boolean;
  readonly preferences: DashboardPreferences;
  readonly refresh: DashboardRefreshStatus;
  readonly query?: DashboardQuery;
}

export interface DashboardSourceInput {
  readonly id: string;
  readonly url: string;
  readonly provider?: RepositoryProvider;
  readonly label?: string;
  readonly branch?: string;
  readonly enabled?: boolean;
  readonly allowDefaultPackages?: boolean;
  readonly packageFolders?: Partial<Record<PackageType, string>>;
}

export type DashboardDetailQuery =
  | { readonly kind: "available" }
  | { readonly kind: "installed"; readonly scope: DashboardScope };

export type DashboardPlanRequest =
  | { readonly action: DashboardLifecycleAction; readonly identities: readonly string[]; readonly scope?: DashboardScope }
  | { readonly action: "install-group"; readonly group: string; readonly scope: DashboardScope }
  | { readonly action: "sync"; readonly scope?: DashboardScope }
  | { readonly action: "set-preferences"; readonly autoUpdate: boolean; readonly autoInstallGroups: readonly string[] }
  | { readonly action: "source-add" | "source-update"; readonly source: DashboardSourceInput }
  | { readonly action: "source-remove"; readonly sourceId: string };

export type DashboardPathEffect = "read" | "write" | "delete" | "move-from" | "move-to" | "state" | "config" | "execute";

export interface DashboardAffectedPath {
  readonly scope: DashboardScope;
  readonly path: string;
  readonly effect: DashboardPathEffect;
}

export interface DashboardPackagePlanItem {
  readonly kind: "package";
  readonly identity: string;
  readonly packageId: string;
  readonly qualifiedName: string;
  readonly sourceId: string;
  readonly action: DashboardLifecycleAction;
  readonly platform: "codex";
  readonly scope: DashboardScope;
  readonly version?: string;
  readonly targetVersion?: string;
  readonly paths: readonly DashboardAffectedPath[];
}

export interface DashboardConfigurationPlanItem {
  readonly kind: "configuration";
  readonly identity: string;
  readonly action: Extract<DashboardOperationAction, "set-preferences" | "source-add" | "source-update" | "source-remove">;
  readonly summary: string;
  readonly changes: readonly DashboardConfigurationFieldChange[];
  readonly paths: readonly DashboardAffectedPath[];
}

export type DashboardReviewValue = string | number | boolean | null
  | readonly DashboardReviewValue[]
  | { readonly [key: string]: DashboardReviewValue };

export interface DashboardConfigurationFieldChange {
  readonly field: string;
  readonly before?: DashboardReviewValue;
  readonly after?: DashboardReviewValue;
}

export type DashboardPlanItem = DashboardPackagePlanItem | DashboardConfigurationPlanItem;

export interface DashboardIneligibleItem {
  readonly identity: string;
  readonly reason: string;
}

export interface DashboardPlan {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly action: DashboardOperationAction;
  readonly destructive: boolean;
  readonly items: readonly DashboardPlanItem[];
  readonly skipped: readonly DashboardIneligibleItem[];
  readonly ineligible: readonly DashboardIneligibleItem[];
  readonly fingerprints: DashboardFingerprints;
}

export interface DashboardApplyRequest {
  readonly planId: string;
}

export interface DashboardApplyResult {
  readonly planId: string;
  readonly applied: boolean;
  readonly count: number;
  readonly fingerprints: DashboardFingerprints;
  readonly failures?: readonly DashboardIneligibleItem[];
}

export interface DashboardDetail {
  readonly row: DashboardRow;
  readonly fingerprints: DashboardFingerprints;
}

export const dashboardDefaultPageSize = 20;
export const dashboardMaximumPageSize = 100;

export function buildDashboardModel(input: DashboardModelInput): DashboardModel {
  const query = normalizeDashboardQuery(input.query);
  const catalog = input.catalog.filter(isCodexPackage);
  const installed = input.installed.filter(isCodexInstallation);
  const serialized = toSerializableMarketplaceModel({
    packages: catalog,
    installed,
    configured: input.configured,
    autoUpdateEnabled: input.preferences.autoUpdate,
    autoInstallGroups: input.preferences.autoInstallGroups,
    knownGroups: collectPackageGroups(catalog, installed),
    defaultPlatform: "codex"
  });
  const available = serialized.packages
    .map((row): DashboardAvailableRow => ({ ...sanitizeAvailable(row), kind: "available" }))
    .filter((row) => row.installOptions.length > 0);
  const installedRows = serialized.installed
    .map((row): DashboardInstalledRow => ({ ...sanitizeInstalled(row), kind: "installed" }))
    .sort((left, right) => Number(right.updateAvailable) - Number(left.updateAvailable) || left.name.localeCompare(right.name));
  const allRows: readonly DashboardRow[] = query.tab === "available"
    ? available
    : query.tab === "updates" ? installedRows.filter((row) => row.updateAvailable) : installedRows;
  const filtered = allRows.filter((row) => matchesQuery(row, query));
  const totalPages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const fingerprints = dashboardFingerprints(catalog, installed, input.preferences);
  return {
    schemaVersion: 1,
    platform: "codex",
    scopes: ["workspace", "global"],
    tab: query.tab,
    configured: input.configured,
    preferences: normalizePreferences(input.preferences),
    refresh: normalizeRefresh(input.refresh),
    counts: {
      available: available.length,
      installed: installedRows.length,
      updates: installedRows.filter((row) => row.updateAvailable).length
    },
    knownGroups: collectPackageGroups(catalog, installed),
    facets: buildFacets(allRows),
    rows: filtered.slice(start, start + query.pageSize),
    pagination: { page, pageSize: query.pageSize, totalItems: filtered.length, totalPages },
    fingerprints
  };
}

export function findDashboardDetail(model: DashboardModel, identity: string): DashboardDetail | undefined {
  const row = model.rows.find((candidate) => rowIdentity(candidate) === identity);
  return row ? { row, fingerprints: model.fingerprints } : undefined;
}

/** Resolves detail from source data rather than the currently paginated dashboard rows. */
export function buildDashboardDetail(input: DashboardModelInput, identity: string, query: DashboardDetailQuery): DashboardDetail | undefined {
  const separator = identity.indexOf(":");
  if (separator <= 0 || separator === identity.length - 1) return undefined;
  const model = buildDashboardModel({
    ...input,
    catalog: input.catalog.filter((pkg) => packageIdentity(pkg) === identity),
    installed: input.installed.filter((item) => installedIdentity(item) === identity),
    query: {
      tab: query.kind,
      ...(query.kind === "installed" ? { scope: query.scope } : {}),
      page: 1,
      pageSize: dashboardMaximumPageSize
    }
  });
  const row = model.rows.find((candidate) => candidate.kind === query.kind && rowIdentity(candidate) === identity
    && (query.kind === "available" || (candidate.kind === "installed" && candidate.scope === query.scope)));
  return row ? { row, fingerprints: model.fingerprints } : undefined;
}

export function dashboardFingerprints(
  catalog: readonly MarketplacePackage[],
  installed: readonly InstalledPackage[],
  preferences: DashboardPreferences
): DashboardFingerprints {
  const catalogValue = catalog.filter(isCodexPackage).map((pkg) => ({
    identity: packageIdentity(pkg),
    version: pkg.manifest.version,
    revision: pkg.sourceRevision ?? "",
    delivery: pkg.manifest.delivery.filter(isDashboardScope).sort(),
    migrations: pkg.manifest.migrations ?? []
  })).sort(compareIdentity);
  const stateValue = installed.filter(isCodexInstallation).map((item) => ({
    identity: installedIdentity(item),
    scope: item.scope,
    version: item.version,
    revision: item.sourceRevision ?? "",
    path: item.installedPath,
    hotloaded: item.hotloaded ?? null,
    autoUpdate: item.autoUpdate ?? null,
    revertedAt: item.revertedAt ?? null,
    migrationHistory: item.migrationHistory ?? []
  })).sort(compareIdentity);
  return {
    catalog: stableFingerprint(catalogValue),
    state: stableFingerprint({ installed: stateValue, preferences: normalizePreferences(preferences) })
  };
}

export function rowIdentity(row: DashboardRow): string {
  return `${row.sourceId ?? "legacy"}:${row.qualifiedName}`;
}

function sanitizeAvailable(row: SerializablePackage): SerializablePackage {
  const installOptions = row.installOptions.filter(isCodexLocalAction);
  const actions = sanitizeActions(row.primaryAction, row.moreActions);
  return { ...row, platforms: ["codex"], installOptions, ...actions };
}

function sanitizeInstalled(row: SerializableInstalledPackage): SerializableInstalledPackage {
  const installOptions = row.installOptions.filter(isCodexLocalAction);
  return { ...row, installOptions, ...sanitizeActions(row.primaryAction, row.moreActions) };
}

function sanitizeActions(primary: CardAction | undefined, more: readonly CardAction[]): { readonly primaryAction?: CardAction; readonly moreActions: readonly CardAction[] } {
  const eligiblePrimary = primary && isCodexLocalAction(primary) ? primary : undefined;
  const eligibleMore = more.filter(isCodexLocalAction);
  return { ...(eligiblePrimary ? { primaryAction: eligiblePrimary } : {}), moreActions: eligibleMore };
}

function isCodexLocalAction(action: { readonly platform?: Platform; readonly scope?: InstallScope }): boolean {
  return (action.platform === undefined || action.platform === "codex")
    && (action.scope === undefined || isDashboardScope(action.scope));
}

function isCodexPackage(pkg: MarketplacePackage): boolean {
  return pkg.manifest.platforms.includes("codex") && pkg.manifest.delivery.some(isDashboardScope);
}

function isCodexInstallation(item: InstalledPackage): item is InstalledPackage & { readonly scope: DashboardScope } {
  return item.platform === "codex" && isDashboardScope(item.scope);
}

function isDashboardScope(scope: InstallScope): scope is DashboardScope {
  return scope === "workspace" || scope === "global";
}

function normalizeDashboardQuery(query: DashboardQuery | undefined): Required<Pick<DashboardQuery, "tab" | "page" | "pageSize">> & DashboardQuery {
  const page = Number.isSafeInteger(query?.page) && (query?.page ?? 0) > 0 ? query!.page! : 1;
  const requestedSize = Number.isSafeInteger(query?.pageSize) && (query?.pageSize ?? 0) > 0 ? query!.pageSize! : dashboardDefaultPageSize;
  return { ...query, tab: query?.tab ?? "available", page, pageSize: Math.min(requestedSize, dashboardMaximumPageSize) };
}

function normalizePreferences(preferences: DashboardPreferences): DashboardPreferences {
  return { autoUpdate: preferences.autoUpdate, autoInstallGroups: [...new Set(preferences.autoInstallGroups)].sort() };
}

function normalizeRefresh(refresh: DashboardRefreshStatus): DashboardRefreshStatus {
  return { ...refresh, warnings: [...refresh.warnings] };
}

function matchesQuery(row: DashboardRow, query: DashboardQuery): boolean {
  if (query.type && row.type !== query.type) return false;
  if (query.group && row.group !== query.group) return false;
  if (query.sourceId && row.sourceId !== query.sourceId) return false;
  if (query.scope && (row.kind !== "installed" || row.scope !== query.scope)) return false;
  const search = query.search?.trim().toLowerCase();
  if (!search) return true;
  return [row.id, row.qualifiedName, row.name, row.description, row.group, row.sourceLabel, row.type, ...row.tags]
    .some((value) => value.toLowerCase().includes(search));
}

function buildFacets(rows: readonly DashboardRow[]): DashboardFacets {
  return {
    types: countFacet(rows.map((row) => row.type)) as readonly { readonly value: PackageType; readonly count: number }[],
    groups: countFacet(rows.map((row) => row.group)),
    sources: [...new Map(rows.map((row) => [row.sourceId ?? "legacy", row.sourceLabel])).entries()]
      .map(([id, label]) => ({ id, label, count: rows.filter((row) => (row.sourceId ?? "legacy") === id).length }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    scopes: countFacet(rows.flatMap((row) => row.kind === "installed" ? [row.scope] : [])) as readonly { readonly value: DashboardScope; readonly count: number }[]
  };
}

function countFacet<T extends string>(values: readonly T[]): readonly { readonly value: T; readonly count: number }[] {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].map(([value, count]) => ({ value, count })).sort((left, right) => left.value.localeCompare(right.value));
}

function stableFingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(text, "utf8")) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function compareIdentity(left: { readonly identity: string }, right: { readonly identity: string }): number {
  return left.identity.localeCompare(right.identity);
}
