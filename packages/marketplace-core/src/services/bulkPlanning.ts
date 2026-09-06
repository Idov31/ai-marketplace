import { type InstallOption } from "./marketplaceModel";
import { type InstallScope, type InstalledPackage, type Platform } from "../types/packages";

export interface BulkPackageSelection {
  readonly packageId: string;
  readonly sourceId?: string;
  readonly qualifiedName?: string;
  readonly platform?: Platform;
}

export interface BulkInstallCandidate {
  readonly selection: BulkPackageSelection;
  readonly options: readonly InstallOption[];
}

export interface BulkUninstallCandidate {
  readonly selection: BulkPackageSelection;
  readonly installed: readonly InstalledPackage[];
}

export interface BulkInstallPlan {
  readonly eligible: readonly { readonly selection: BulkPackageSelection; readonly option: InstallOption }[];
  readonly skipped: readonly BulkPackageSelection[];
}

export interface BulkUninstallPlan {
  readonly eligible: readonly InstalledPackage[];
  readonly skipped: readonly BulkPackageSelection[];
}

const localInstallScopes = ["workspace", "global"] as const;
const uninstallScopes = ["workspace", "global", "cloud"] as const;

export function availableBulkInstallScopes(candidates: readonly BulkInstallCandidate[]): readonly (typeof localInstallScopes)[number][] {
  return localInstallScopes.filter((scope) => candidates.some((candidate) => installOptionForScope(candidate.options, scope) !== undefined));
}

export function planBulkInstall(candidates: readonly BulkInstallCandidate[], scope: (typeof localInstallScopes)[number]): BulkInstallPlan {
  const eligible: { selection: BulkPackageSelection; option: InstallOption }[] = [];
  const skipped: BulkPackageSelection[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = selectionKey(candidate.selection);
    if (seen.has(key)) continue;
    seen.add(key);
    const option = installOptionForScope(candidate.options, scope);
    if (!option) {
      skipped.push(candidate.selection);
      continue;
    }
    eligible.push({ selection: candidate.selection, option });
  }
  return { eligible, skipped };
}

export function availableBulkUninstallScopes(candidates: readonly BulkUninstallCandidate[]): readonly InstallScope[] {
  return uninstallScopes.filter((scope) => candidates.some((candidate) => matchingUninstallTargets(candidate.installed, candidate.selection).some((item) => item.scope === scope)));
}

export function planBulkUninstall(candidates: readonly BulkUninstallCandidate[], scope: InstallScope): BulkUninstallPlan {
  const eligible: InstalledPackage[] = [];
  const skipped: BulkPackageSelection[] = [];
  const seenSelections = new Set<string>();
  const seenInstalled = new Set<string>();
  for (const candidate of candidates) {
    const key = selectionKey(candidate.selection);
    if (seenSelections.has(key)) continue;
    seenSelections.add(key);
    const target = matchingUninstallTargets(candidate.installed, candidate.selection).find((item) => item.scope === scope);
    if (!target) {
      skipped.push(candidate.selection);
      continue;
    }
    const installedKey = `${installedIdentity(target)}:${target.platform}:${target.scope}`;
    if (!seenInstalled.has(installedKey)) {
      seenInstalled.add(installedKey);
      eligible.push(target);
    }
  }
  return { eligible, skipped };
}

export function matchingUninstallTargets(installed: readonly InstalledPackage[], selection: BulkPackageSelection): readonly InstalledPackage[] {
  return installed.filter((item) => item.id === selection.packageId
    && (selection.sourceId === undefined || item.sourceId === selection.sourceId)
    && (selection.qualifiedName === undefined || (item.qualifiedName ?? item.id) === selection.qualifiedName)
    && (selection.platform === undefined || item.platform === selection.platform));
}

function installOptionForScope(options: readonly InstallOption[], scope: (typeof localInstallScopes)[number]): InstallOption | undefined {
  return options.find((option) => option.scope === scope && option.action !== "installCloud");
}

function selectionKey(selection: BulkPackageSelection): string {
  return `${selection.sourceId ?? "legacy"}:${selection.qualifiedName ?? selection.packageId}:${selection.platform ?? ""}`;
}

function installedIdentity(installed: InstalledPackage): string {
  return `${installed.sourceId ?? "legacy"}:${installed.qualifiedName ?? installed.id}`;
}
