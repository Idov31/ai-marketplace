import { type InstalledPackage, type MarketplacePackage, type Platform } from "../types/packages";
import { installedIdentity, installOptionsForPackage, packageIdentity } from "./marketplaceModel";

export type GroupInstallScope = "workspace" | "global";

export interface GroupInstallPlan {
  readonly pkg: MarketplacePackage;
  readonly platform: Platform;
  readonly scope: GroupInstallScope;
}

export interface AutoInstallGroupPlan {
  readonly pkg: MarketplacePackage;
  readonly platform: Platform;
}

export function planGroupInstall(
  group: string,
  scope: GroupInstallScope,
  catalog: readonly MarketplacePackage[],
  installed: readonly InstalledPackage[],
  defaultPlatform: Platform
): readonly GroupInstallPlan[] {
  const normalizedGroup = group.trim();
  if (!normalizedGroup) return [];
  return catalog.flatMap((pkg) => {
    if (pkg.manifest.group !== normalizedGroup) return [];
    const matching = installed.filter((item) => installedIdentity(item) === packageIdentity(pkg));
    const option = installOptionsForPackage(pkg, matching, defaultPlatform)
      .find((candidate) => candidate.scope === scope);
    return option ? [{ pkg, platform: option.platform, scope }] : [];
  });
}

export function autoInstallGroupPlans(
  catalog: readonly MarketplacePackage[],
  installed: readonly InstalledPackage[],
  groups: readonly string[],
  defaultPlatform: Platform
): readonly AutoInstallGroupPlan[] {
  const enabled = new Set(normalizeGroupList(groups));
  if (enabled.size === 0) return [];
  return catalog.flatMap((pkg) => {
    if (!enabled.has(pkg.manifest.group) || !pkg.manifest.delivery.includes("global")) return [];
    const identity = packageIdentity(pkg);
    if (installed.some((item) => installedIdentity(item) === identity || (item.sourceId === undefined && item.id === pkg.manifest.id))) return [];
    const platform = pkg.manifest.platforms.includes(defaultPlatform) ? defaultPlatform : pkg.manifest.platforms[0];
    return platform ? [{ pkg, platform }] : [];
  });
}

export function collectPackageGroups(catalog: readonly MarketplacePackage[], installed: readonly InstalledPackage[] = []): readonly string[] {
  return normalizeGroupList([
    ...catalog.map((pkg) => pkg.manifest.group),
    ...installed.map((pkg) => pkg.group ?? "")
  ]);
}

export function normalizeGroupList(groups: readonly string[]): readonly string[] {
  return [...new Set(groups.map((group) => group.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
