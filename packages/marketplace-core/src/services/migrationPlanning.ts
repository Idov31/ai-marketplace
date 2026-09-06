import type { InstalledPackage, MarketplacePackage, PackageMigration } from "../types/packages";
import { compareVersions } from "./versioning";

export interface MigrationCandidate {
  readonly destination: MarketplacePackage;
  readonly predecessor: InstalledPackage;
}

export interface IneligibleMigration extends MigrationCandidate { readonly reason: string; }
export interface MigrationPlan { readonly eligible: readonly MigrationCandidate[]; readonly ineligible: readonly IneligibleMigration[]; }

export function planPackageMigrations(catalog: readonly MarketplacePackage[], installed: readonly InstalledPackage[]): MigrationPlan {
  const raw: MigrationCandidate[] = [];
  const ineligible: IneligibleMigration[] = [];
  for (const destination of catalog) {
    for (const migration of destination.manifest.migrations ?? []) {
      for (const predecessor of installed.filter((item) => matchesMigration(destination, migration, item))) {
        const reason = incompatibilityReason(destination, predecessor, installed);
        if (reason) ineligible.push({ destination, predecessor, reason });
        else raw.push({ destination, predecessor });
      }
    }
  }
  const eligible: MigrationCandidate[] = [];
  for (const candidate of deduplicate(raw)) {
    const predecessorClaims = raw.filter((item) => installKey(item.predecessor) === installKey(candidate.predecessor));
    const destinationClaims = raw.filter((item) => targetKey(item) === targetKey(candidate));
    const reason = new Set(predecessorClaims.map((item) => destinationIdentity(item.destination))).size > 1
      ? "Multiple destination packages claim this predecessor installation."
      : new Set(destinationClaims.map((item) => installKey(item.predecessor))).size > 1
        ? "Multiple predecessor installations target the same destination platform and scope."
        : undefined;
    if (reason) ineligible.push({ ...candidate, reason });
    else eligible.push(candidate);
  }
  return { eligible, ineligible: deduplicateIneligible(ineligible) };
}

export function matchesMigration(destination: MarketplacePackage, migration: PackageMigration, installed: InstalledPackage): boolean {
  const sourceId = migration.from.sourceId ?? destination.source.id;
  const qualifiedName = migration.from.name ?? destination.manifest.qualifiedName;
  const id = qualifiedName.split("/").at(-1);
  if (installed.sourceId !== undefined) return installed.sourceId === sourceId && (installed.qualifiedName ?? installed.id) === qualifiedName;
  return migration.from.repository !== undefined
    && installed.id === id
    && installed.sourceRepo === migration.from.repository
    && installed.sourceBranch === migration.from.branch
    && normalizeRepoPath(installed.sourcePath) === normalizeRepoPath(migration.from.path!);
}

export function migrationFor(destination: MarketplacePackage, predecessor: InstalledPackage, catalog: readonly MarketplacePackage[], installed: readonly InstalledPackage[]): MigrationCandidate | undefined {
  return planPackageMigrations(catalog, installed).eligible.find((item) =>
    destinationIdentity(item.destination) === destinationIdentity(destination) && installKey(item.predecessor) === installKey(predecessor));
}

function incompatibilityReason(destination: MarketplacePackage, predecessor: InstalledPackage, installed: readonly InstalledPackage[]): string | undefined {
  if (destination.manifest.type !== predecessor.type) return "Destination package type does not match the predecessor.";
  if (!destination.manifest.platforms.includes(predecessor.platform)) return "Destination package does not support the installed platform.";
  if (!destination.manifest.delivery.includes(predecessor.scope)) return "Destination package does not support the installed scope.";
  if (compareVersions(destination.manifest.version, predecessor.version) < 0) return "Destination version is older than the installed predecessor.";
  const collision = installed.some((item) => item.platform === predecessor.platform && item.scope === predecessor.scope
    && item.sourceId === destination.source.id && item.qualifiedName === destination.manifest.qualifiedName);
  return collision ? "Destination package is already installed for this platform and scope." : undefined;
}

function deduplicate(candidates: readonly MigrationCandidate[]): readonly MigrationCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((item) => { const key = `${destinationIdentity(item.destination)}:${installKey(item.predecessor)}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
function deduplicateIneligible(candidates: readonly IneligibleMigration[]): readonly IneligibleMigration[] {
  const seen = new Set<string>();
  return candidates.filter((item) => { const key = `${destinationIdentity(item.destination)}:${installKey(item.predecessor)}:${item.reason}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
function destinationIdentity(pkg: MarketplacePackage): string { return `${pkg.source.id}:${pkg.manifest.qualifiedName}`; }
function installKey(item: InstalledPackage): string { return `${item.sourceId ?? "legacy"}:${item.qualifiedName ?? item.id}:${item.platform}:${item.scope}`; }
function targetKey(item: MigrationCandidate): string { return `${destinationIdentity(item.destination)}:${item.predecessor.platform}:${item.predecessor.scope}`; }
function normalizeRepoPath(value: string): string { return `/${value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")}`; }
