import { isUpdateAvailable } from "./versioning";
import { platforms, type InstallScope, type InstalledPackage, type MarketplacePackage, type Platform } from "../types/packages";
import { planPackageMigrations, type MigrationCandidate } from "./migrationPlanning";

export interface CardAction {
  readonly action: "install" | "installGlobal" | "installCloud" | "installDifferentPlatform" | "uninstall" | "update" | "migrate" | "revert" | "hotload" | "offload";
  readonly label: string;
  readonly platform?: Platform;
  readonly scope?: InstallScope;
  readonly tone: "primary" | "secondary" | "danger";
  /** A visible action that cannot run until its prerequisite is satisfied. */
  readonly disabled?: boolean;
}
export interface PackageCardStatus { readonly kind: "available" | "installed" | "outdated" | "migration" | "reverted" | "offloaded" | "cloud" | "mcp"; readonly label: string; }

export interface SerializablePackage {
  readonly id: string;
  readonly qualifiedName: string;
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly repositoryKey: string;
  readonly group: string;
  readonly name: string;
  readonly type: string;
  readonly version: string;
  readonly description: string;
  readonly platforms: readonly Platform[];
  readonly tags: readonly string[];
  readonly evaluationScore?: number;
  readonly hotload: boolean;
  readonly updateAvailable: boolean;
  readonly installOptions: readonly InstallOption[];
  readonly status: PackageCardStatus;
  readonly primaryAction?: CardAction;
  readonly moreActions: readonly CardAction[];
  readonly migration?: SerializableMigration;
}

export interface SerializableInstalledPackage extends InstalledPackage {
  readonly sourceLabel: string;
  readonly repositoryKey: string;
  readonly group: string;
  readonly qualifiedName: string;
  readonly latestVersion?: string;
  readonly updateAvailable: boolean;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly evaluationScore?: number;
  readonly installOptions: readonly InstallOption[];
  readonly status: PackageCardStatus;
  readonly primaryAction?: CardAction;
  readonly moreActions: readonly CardAction[];
  readonly migration?: SerializableMigration;
}

export interface SerializableMigration {
  readonly destinationSourceId: string;
  readonly destinationQualifiedName: string;
  readonly predecessorId?: string;
  readonly predecessorSourceId?: string;
  readonly predecessorQualifiedName?: string;
  readonly platform?: Platform;
  readonly scope?: InstallScope;
}

export interface InstallOption {
  readonly action: "install" | "installGlobal" | "installCloud" | "installDifferentPlatform";
  readonly scope: InstallScope;
  readonly platform: Platform;
  readonly label: string;
}

export interface SerializableMarketplaceModel {
  readonly configured: boolean;
  readonly autoUpdateEnabled: boolean;
  readonly defaultPlatform: Platform;
  readonly autoInstallGroups: readonly string[];
  readonly knownGroups: readonly string[];
  readonly extensionVersion: string;
  readonly packages: readonly SerializablePackage[];
  readonly installed: readonly SerializableInstalledPackage[];
}

export function packageIdentity(pkg: MarketplacePackage): string {
  return `${pkg.source.id}:${pkg.manifest.qualifiedName}`;
}

export function installedIdentity(installed: Pick<InstalledPackage, "sourceId" | "qualifiedName" | "id">): string {
  return `${installed.sourceId ?? "legacy"}:${installed.qualifiedName ?? installed.id}`;
}

export function toSerializableMarketplaceModel(model: {
  readonly packages: readonly MarketplacePackage[];
  readonly installed: readonly InstalledPackage[];
  readonly configured: boolean;
  readonly autoUpdateEnabled: boolean;
  readonly defaultPlatform: Platform;
  readonly autoInstallGroups?: readonly string[];
  readonly knownGroups?: readonly string[];
  readonly extensionVersion?: string;
}): SerializableMarketplaceModel {
  const packagesByIdentity = new Map(model.packages.map((pkg) => [packageIdentity(pkg), pkg]));
  const migrations = planPackageMigrations(model.packages, model.installed).eligible;
  const installed: SerializableInstalledPackage[] = model.installed.map((item): SerializableInstalledPackage => {
    const pkg = packagesByIdentity.get(installedIdentity(item));
    const latestVersion = pkg?.manifest.version;
    const installOptions = pkg ? installOptionsForPackage(pkg, model.installed.filter((candidate) => installedIdentity(candidate) === packageIdentity(pkg)), model.defaultPlatform) : [];
    const updateAvailable = latestVersion
      ? isUpdateAvailable(item.version, latestVersion) || isRollbackPinned(item)
      : false;
    const migration = migrations.find((candidate) => sameInstallation(candidate.predecessor, item));
    const card = installedCardActions(item, pkg, installOptions, updateAvailable, migration);
    return {
      ...item,
      sourceLabel: pkg?.source.label ?? item.sourceRepo,
      repositoryKey: repositoryFilterKey(item),
      group: pkg?.manifest.group ?? item.group ?? "unknown",
      qualifiedName: pkg?.manifest.qualifiedName ?? item.qualifiedName ?? item.id,
      latestVersion,
      updateAvailable,
      name: pkg?.manifest.name ?? item.id,
      description: pkg?.manifest.description ?? item.installedPath,
      tags: pkg?.manifest.tags ?? [item.type, item.platform],
      evaluationScore: pkg?.manifest.evaluationScore,
      installOptions,
      ...card,
      ...(migration === undefined ? {} : { migration: serializeMigration(migration) })
    };
  });

  const packages: SerializablePackage[] = model.packages
    .map((pkg): SerializablePackage => {
      const matchingInstalled = model.installed.filter((item) => installedIdentity(item) === packageIdentity(pkg));
      const packageMigrations = migrations.filter((candidate) => packageIdentity(candidate.destination) === packageIdentity(pkg));
      const migration = packageMigrations[0];
      const installOptions = installOptionsForPackage(pkg, matchingInstalled, model.defaultPlatform);
      const primaryAction: CardAction | undefined = migration
        ? { action: "migrate", label: "Migrate", tone: "primary", platform: migration.predecessor.platform, scope: migration.predecessor.scope }
        : installOptions[0] ? cardAction(installOptions[0], "primary") : undefined;
      return {
        id: pkg.manifest.id,
        qualifiedName: pkg.manifest.qualifiedName,
        sourceId: pkg.source.id,
        sourceLabel: pkg.source.label,
        repositoryKey: repositoryFilterKey({ sourceId: pkg.source.id, sourceLabel: pkg.source.label, sourceRepo: pkg.source.repository }),
        group: pkg.manifest.group,
        name: pkg.manifest.name,
        type: pkg.manifest.type,
        version: pkg.manifest.version,
        description: pkg.manifest.description,
        platforms: pkg.manifest.platforms,
        tags: pkg.manifest.tags,
        evaluationScore: pkg.manifest.evaluationScore,
        hotload: pkg.hotload,
        updateAvailable: matchingInstalled.some((item) => isUpdateAvailable(item.version, pkg.manifest.version) || isRollbackPinned(item)),
        installOptions,
        status: { kind: "available", label: "Available" },
        ...(primaryAction === undefined ? {} : { primaryAction }),
        moreActions: (migration ? installOptions : installOptions.slice(1)).map((option) => cardAction(option, "secondary")),
        ...(migration === undefined ? {} : { migration: packageMigrations.length === 1 ? serializeMigration(migration) : { destinationSourceId: pkg.source.id, destinationQualifiedName: pkg.manifest.qualifiedName } })
      };
    })
    .filter((pkg) => pkg.installOptions.length > 0)
    .sort((left, right) => Number(right.updateAvailable) - Number(left.updateAvailable) || left.name.localeCompare(right.name));

  return {
    configured: model.configured,
    autoUpdateEnabled: model.autoUpdateEnabled,
    defaultPlatform: model.defaultPlatform,
    autoInstallGroups: model.autoInstallGroups ?? [],
    knownGroups: model.knownGroups ?? [],
    extensionVersion: model.extensionVersion ?? "0.0.0",
    packages,
    installed
  };
}

function isRollbackPinned(installed: InstalledPackage): boolean { return installed.autoUpdate === false && installed.revertedAt !== undefined; }
function cardAction(option: InstallOption, tone: CardAction["tone"]): CardAction { return { ...option, tone }; }
function installedCardActions(installed: InstalledPackage, pkg: MarketplacePackage | undefined, installOptions: readonly InstallOption[], updateAvailable: boolean, migration?: MigrationCandidate): { readonly status: PackageCardStatus; readonly primaryAction?: CardAction; readonly moreActions: readonly CardAction[] } {
  const pinned = isRollbackPinned(installed); const isMcp = installed.type === "mcp"; const isCloud = installed.scope === "cloud"; const offloaded = !isCloud && !isMcp && installed.installedPath.startsWith(".offload/");
  const status: PackageCardStatus = migration ? { kind: "migration", label: "Migration available" } : pinned ? { kind: "reverted", label: "Reverted, pinned" } : isMcp ? { kind: "mcp", label: "Installed and configured" } : isCloud ? { kind: "cloud", label: "Cloud" } : offloaded ? { kind: "offloaded", label: "Offloaded" } : updateAvailable ? { kind: "outdated", label: "Update available" } : { kind: "installed", label: "Installed" };
  const more = installOptions.map((option) => cardAction(option, "secondary"));
  if (migration && updateAvailable) more.unshift({ action: "migrate", label: "Migrate", tone: "secondary", platform: installed.platform, scope: installed.scope });
  if (pkg?.manifest.previousVersion && !pinned) more.push(!updateAvailable
    ? { action: "revert", label: "Revert to previous version", tone: "secondary", platform: installed.platform, scope: installed.scope }
    : { action: "revert", label: "Revert to previous version (update first)", tone: "secondary", platform: installed.platform, scope: installed.scope, disabled: true });
  if (updateAvailable && !isCloud && !isMcp) more.push({ action: offloaded ? "hotload" : "offload", label: offloaded ? "Hotload" : "Offload", tone: "secondary", platform: installed.platform, scope: installed.scope });
  more.push({ action: "uninstall", label: "Uninstall", tone: "danger", platform: installed.platform, scope: installed.scope });
  const primaryAction = migration && !updateAvailable
    ? { action: "migrate" as const, label: "Migrate", tone: "primary" as const, platform: installed.platform, scope: installed.scope }
    : updateAvailable ? { action: "update" as const, label: pinned ? "Update to latest" : "Update", tone: "primary" as const, platform: installed.platform, scope: installed.scope } : !isCloud && !isMcp ? { action: offloaded ? "hotload" as const : "offload" as const, label: offloaded ? "Hotload" : "Offload", tone: "primary" as const, platform: installed.platform, scope: installed.scope } : undefined;
  return { status, ...(primaryAction === undefined ? {} : { primaryAction }), moreActions: more };
}

function serializeMigration(candidate: MigrationCandidate): SerializableMigration {
  return {
    destinationSourceId: candidate.destination.source.id,
    destinationQualifiedName: candidate.destination.manifest.qualifiedName,
    predecessorId: candidate.predecessor.id,
    ...(candidate.predecessor.sourceId === undefined ? {} : { predecessorSourceId: candidate.predecessor.sourceId }),
    ...(candidate.predecessor.qualifiedName === undefined ? {} : { predecessorQualifiedName: candidate.predecessor.qualifiedName }),
    platform: candidate.predecessor.platform,
    scope: candidate.predecessor.scope
  };
}

function sameInstallation(left: InstalledPackage, right: InstalledPackage): boolean {
  return left.id === right.id && left.sourceId === right.sourceId && left.platform === right.platform && left.scope === right.scope;
}

export function installOptionsForPackage(
  pkg: MarketplacePackage,
  installed: readonly InstalledPackage[],
  defaultPlatform: Platform
): readonly InstallOption[] {
  if (pkg.manifest.type === "mcp") {
    return installOptionsForMcpPackage(pkg, installed, defaultPlatform);
  }
  const options: InstallOption[] = [];
  const orderedPlatforms = orderPlatforms(pkg.manifest.platforms, defaultPlatform);
  const delivery = pkg.manifest.delivery;
  const workspacePlatform = delivery.includes("workspace")
    ? orderedPlatforms.find((platform) => !isInstalled(installed, platform, "workspace"))
    : undefined;
  if (workspacePlatform) {
    options.push(installed.some((item) => item.scope === "workspace")
      ? {
        action: "installDifferentPlatform",
        scope: "workspace",
        platform: workspacePlatform,
        label: "Install in workspace for different platform"
      }
      : {
        action: "install",
        scope: "workspace",
        platform: workspacePlatform,
        label: workspacePlatform === defaultPlatform ? "Install" : `Install for ${platformLabel(workspacePlatform)}`
      });
  }
  const globalPlatform = delivery.includes("global")
    ? orderedPlatforms.find((platform) => !isInstalled(installed, platform, "global"))
    : undefined;
  if (globalPlatform) {
    options.push(installed.some((item) => item.scope === "global")
      ? {
        action: "installDifferentPlatform",
        scope: "global",
        platform: globalPlatform,
        label: "Install in user directory for different platform"
      }
      : {
        action: "installGlobal",
        scope: "global",
        platform: globalPlatform,
        label: "Install in user directory"
      });
  }
  const cloudPlatform = delivery.includes("cloud")
    ? orderedPlatforms.find((platform) => !isInstalled(installed, platform, "cloud"))
    : undefined;
  if (cloudPlatform) {
    options.push({
      action: "installCloud",
      scope: "cloud",
      platform: cloudPlatform,
      label: `Install to ${platformLabel(cloudPlatform)} cloud`
    });
  }
  return dedupeOptions(options);
}

export function eligibleInstallPlatforms(
  pkg: MarketplacePackage,
  installed: readonly InstalledPackage[],
  scope: InstallScope
): readonly Platform[] {
  const identity = packageIdentity(pkg);
  const matchingInstalled = installed.filter((item) => installedIdentity(item) === identity);
  return platforms
    .filter((platform) => pkg.manifest.platforms.includes(platform))
    .filter((platform) => !matchingInstalled.some((item) => item.platform === platform && item.scope === scope));
}

export function repositoryFilterKey(item: {
  readonly sourceId?: string;
  readonly sourceLabel?: string;
  readonly sourceRepo?: string;
}): string {
  return item.sourceId ? `source:${item.sourceId}` : `legacy:${item.sourceRepo ?? item.sourceLabel ?? "unknown"}`;
}

function installOptionsForMcpPackage(
  pkg: MarketplacePackage,
  installed: readonly InstalledPackage[],
  defaultPlatform: Platform
): readonly InstallOption[] {
  const platform = mcpInstallPlatformCandidates(pkg, installed, defaultPlatform)[0];
  return platform
    ? [{ action: "installGlobal", scope: "global", platform, label: `Configure for ${platformLabel(platform)} in user directory` }]
    : [];
}

export function mcpInstallPlatformCandidates(
  pkg: MarketplacePackage,
  installed: readonly InstalledPackage[],
  defaultPlatform: Platform
): readonly Platform[] {
  return orderPlatforms(pkg.manifest.platforms, defaultPlatform)
    .filter((platform) => !isInstalled(installed, platform, "global"));
}

function isInstalled(installed: readonly InstalledPackage[], platform: Platform, scope: InstallScope): boolean {
  return installed.some((item) => item.platform === platform && item.scope === scope);
}

function orderPlatforms(available: readonly Platform[], defaultPlatform: Platform): readonly Platform[] {
  return [...available].sort((left, right) => {
    if (left === defaultPlatform) return -1;
    if (right === defaultPlatform) return 1;
    return platforms.indexOf(left) - platforms.indexOf(right);
  });
}

function dedupeOptions(options: readonly InstallOption[]): readonly InstallOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = `${option.action}:${option.scope}:${option.platform}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function platformLabel(platform: Platform): string {
  switch (platform) {
    case "codex": return "Codex";
    case "cursor": return "Cursor";
    case "github-copilot": return "GitHub Copilot";
    case "claude": return "Claude";
  }
}
