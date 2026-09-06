import { installScopes, platforms, type InstallScope, type InstalledPackage, type InstalledState, type Platform } from "../types/packages";
import { legacyStateRelativePath, stateRelativePath } from "./pathPlanning";
import { type MarketplaceStorage } from "../ports";

export class InstalledStateStore {
  public constructor(private readonly storage: MarketplaceStorage, private readonly scope: InstallScope) {}

  public async read(): Promise<InstalledState> {
    for (const relativePath of [stateRelativePath(), legacyStateRelativePath()]) {
      const bytes = await this.storage.readFile(this.scope, relativePath);
      if (bytes !== undefined) {
        const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as Partial<InstalledState>;
        return {
          schemaVersion: 2,
          packages: Array.isArray(parsed.packages) ? parsed.packages.filter(isInstalledPackage) : []
        };
      }
    }
    return { schemaVersion: 2, packages: [] };
  }

  public async upsert(pkg: InstalledPackage): Promise<void> {
    const state = await this.read();
    const packages = state.packages.filter((item) => !sameInstallIdentity(item, pkg.id, pkg.platform, pkg.scope, pkg.sourceId));
    packages.push(pkg);
    await this.write({ ...state, packages: packages.sort(compareInstalledPackages) });
  }

  public async remove(id: string, platform: Platform, scope: InstallScope, sourceId?: string): Promise<InstalledPackage | undefined> {
    const state = await this.read();
    const existing = state.packages.find((item) => sameInstallIdentity(item, id, platform, scope, sourceId));
    if (!existing) {
      return undefined;
    }
    await this.write({ ...state, packages: state.packages.filter((item) => !sameInstallIdentity(item, id, platform, scope, sourceId)) });
    return existing;
  }

  /** Removes one exact persisted installation without broad legacy identity matching. */
  public async removeInstalled(pkg: InstalledPackage): Promise<InstalledPackage | undefined> {
    const state = await this.read();
    const existing = state.packages.find((item) => sameInstalledRecord(item, pkg));
    if (!existing) return undefined;
    await this.write({ ...state, packages: state.packages.filter((item) => !sameInstalledRecord(item, pkg)) });
    return existing;
  }

  /** Atomically swaps one installation identity for another in a single state write. */
  public async replace(previous: InstalledPackage, next: InstalledPackage): Promise<void> {
    const state = await this.read();
    const existing = state.packages.find((item) => sameInstalledRecord(item, previous));
    if (!existing) throw new Error(`Installed predecessor '${previous.qualifiedName ?? previous.id}' was not found.`);
    const collision = state.packages.find((item) => sameInstallIdentity(item, next.id, next.platform, next.scope, next.sourceId)
      && !sameInstalledRecord(item, previous));
    if (collision) throw new Error(`Destination package '${next.qualifiedName ?? next.id}' is already installed.`);
    const packages = state.packages.filter((item) => !sameInstalledRecord(item, previous));
    packages.push(next);
    await this.write({ ...state, packages: packages.sort(compareInstalledPackages) });
  }

  public async discardLegacyAutomationPreferences(): Promise<boolean> {
    let changed = false;
    for (const relativePath of [stateRelativePath(), legacyStateRelativePath()]) {
      const bytes = await this.storage.readFile(this.scope, relativePath);
      if (bytes === undefined) continue;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (!("autoUpdateEnabled" in parsed) && !("autoUpdateChangedAt" in parsed)
        && !("autoInstallGroups" in parsed) && !("autoInstallGroupsChangedAt" in parsed)) continue;
      const packages = Array.isArray(parsed.packages) ? parsed.packages.filter(isInstalledPackage) : [];
      await this.storage.writeFileAtomic(this.scope, relativePath, Buffer.from(`${JSON.stringify({ schemaVersion: 2, packages }, null, 2)}\n`, "utf8"));
      changed = true;
    }
    return changed;
  }

  private async write(state: InstalledState): Promise<void> {
    await this.storage.writeFileAtomic(this.scope, stateRelativePath(), Buffer.from(`${JSON.stringify({ ...state, schemaVersion: 2 }, null, 2)}\n`, "utf8"));
  }
}

function compareInstalledPackages(left: InstalledPackage, right: InstalledPackage): number {
  return `${left.scope}:${left.platform}:${left.type}:${left.sourceId ?? ""}:${left.qualifiedName ?? left.id}`
    .localeCompare(`${right.scope}:${right.platform}:${right.type}:${right.sourceId ?? ""}:${right.qualifiedName ?? right.id}`);
}

function sameInstallIdentity(pkg: InstalledPackage, id: string, platform: Platform, scope: InstallScope, sourceId?: string): boolean {
  if (pkg.id !== id || pkg.platform !== platform || pkg.scope !== scope) {
    return false;
  }
  return sourceId === undefined || pkg.sourceId === sourceId;
}

function sameInstalledRecord(left: InstalledPackage, right: InstalledPackage): boolean {
  return left.id === right.id && left.platform === right.platform && left.scope === right.scope
    && left.sourceId === right.sourceId && left.qualifiedName === right.qualifiedName
    && left.sourceRepo === right.sourceRepo && left.sourceBranch === right.sourceBranch && left.sourcePath === right.sourcePath;
}

function isInstalledPackage(value: unknown): value is InstalledPackage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const scope = record.scope === undefined ? "workspace" : record.scope;
  if (!installScopes.includes(scope as InstallScope)) {
    return false;
  }
  if (record.scope === undefined) {
    record.scope = "workspace";
  }
  return typeof record.id === "string"
    && typeof record.type === "string"
    && typeof record.platform === "string"
    && platforms.includes(record.platform as Platform)
    && typeof record.scope === "string"
    && typeof record.version === "string"
    && typeof record.sourceRepo === "string"
    && typeof record.sourceBranch === "string"
    && typeof record.sourcePath === "string"
    && typeof record.installedPath === "string"
    && typeof record.installedAt === "string"
    && (record.sourceId === undefined || typeof record.sourceId === "string")
    && (record.qualifiedName === undefined || typeof record.qualifiedName === "string")
    && (record.group === undefined || typeof record.group === "string")
    && (record.managedConfig === undefined || isManagedConfigContribution(record.managedConfig))
    && (record.managedPayloadPath === undefined || typeof record.managedPayloadPath === "string")
    && (record.hotloaded === undefined || typeof record.hotloaded === "boolean")
    && (record.hotloadRequestedAt === undefined || typeof record.hotloadRequestedAt === "string")
    && (record.offloadRequestedAt === undefined || typeof record.offloadRequestedAt === "string")
    && (record.autoUpdate === undefined || typeof record.autoUpdate === "boolean")
    && (record.autoUpdateChangedAt === undefined || typeof record.autoUpdateChangedAt === "string")
    && (record.sourceRevision === undefined || typeof record.sourceRevision === "string")
    && (record.revertedAt === undefined || typeof record.revertedAt === "string")
    && (record.revertedFromVersion === undefined || typeof record.revertedFromVersion === "string")
    && (record.migrationHistory === undefined || (Array.isArray(record.migrationHistory) && record.migrationHistory.every(isMigrationHistoryEntry)));
}

function isMigrationHistoryEntry(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.migratedAt !== "string") return false;
  return isMigrationSnapshot(value.from) && isMigrationSnapshot(value.to);
}

function isMigrationSnapshot(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  return typeof value.id === "string"
    && typeof value.qualifiedName === "string"
    && (value.sourceId === undefined || typeof value.sourceId === "string")
    && typeof value.version === "string"
    && typeof value.repository === "string"
    && typeof value.branch === "string"
    && typeof value.path === "string";
}

function isManagedConfigContribution(value: unknown): boolean {
  if (!isPlainRecord(value)) {
    return false;
  }
  if (value.kind === "mcp") {
    return typeof value.serverName === "string" && isPlainRecord(value.serverConfig);
  }
  if (value.kind === "hook") {
    return isPlainRecord(value.hooks) && Object.values(value.hooks).every(Array.isArray);
  }
  if (value.kind === "codex-agent") {
    return typeof value.configPath === "string"
      && typeof value.contentSha256 === "string"
      && /^[0-9a-f]{64}$/.test(value.contentSha256);
  }
  return false;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
