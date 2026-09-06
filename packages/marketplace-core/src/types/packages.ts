export const packageTypes = ["skill", "command", "mcp", "agent", "hook", "rule"] as const;
export type PackageType = (typeof packageTypes)[number];

export const platforms = ["codex", "cursor", "github-copilot", "claude"] as const;
export type Platform = (typeof platforms)[number];

export const installScopes = ["workspace", "global", "cloud"] as const;
export type InstallScope = (typeof installScopes)[number];

export const repositoryProviders = ["github", "azure-devops", "gitlab"] as const;
export type RepositoryProvider = (typeof repositoryProviders)[number];

export interface PackageManifest {
  readonly id: string;
  readonly qualifiedName: string;
  readonly name: string;
  readonly group: string;
  readonly type: PackageType;
  readonly version: string;
  readonly description: string;
  readonly platforms: readonly Platform[];
  readonly delivery: readonly InstallScope[];
  readonly entrypoint: string;
  readonly tags: readonly string[];
  /** Explicit canonical default-install behavior; legacy callers may omit it. */
  readonly defaultInstall?: boolean;
  /** A validated Git revision containing the package version to restore. */
  readonly previousVersion?: string;
  readonly icon?: string;
  readonly evaluationScore?: number;
  /** Explicit predecessor identities accepted by this destination package. */
  readonly migrations?: readonly PackageMigration[];
}

export interface PackageMigration {
  readonly from: PackageMigrationSource;
}

export interface PackageMigrationSource {
  /** Omitted values inherit the destination package source id and name. */
  readonly sourceId?: string;
  readonly name?: string;
  /** Exact fallback provenance for installed records that predate source-aware identity. */
  readonly repository?: string;
  readonly branch?: string;
  readonly path?: string;
}

interface RepositoryConfigBase {
  readonly id: string;
  readonly label: string;
  readonly repository: string;
  readonly branch: string;
  readonly enabled: boolean;
  readonly allowDefaultPackages: boolean;
  readonly packageFolders: Readonly<Record<PackageType, string>>;
}

export interface GitHubRepositoryConfig extends RepositoryConfigBase {
  readonly provider: "github";
  readonly host: "github.com";
  readonly owner: string;
}

export interface AzureDevOpsRepositoryConfig extends RepositoryConfigBase {
  readonly provider: "azure-devops";
  readonly host: "dev.azure.com";
  readonly organization: string;
  readonly project: string;
}

export interface GitLabRepositoryConfig extends RepositoryConfigBase {
  readonly provider: "gitlab";
  readonly host: string;
  readonly namespace: string;
}

export type RepositoryConfig = GitHubRepositoryConfig | AzureDevOpsRepositoryConfig | GitLabRepositoryConfig;

interface PackageSourceBase {
  readonly id: string;
  readonly label: string;
  readonly repository: string;
  readonly branch: string;
}

export interface GitHubPackageSource extends PackageSourceBase {
  readonly provider: "github";
  readonly host: "github.com";
  readonly owner: string;
}

export interface AzureDevOpsPackageSource extends PackageSourceBase {
  readonly provider: "azure-devops";
  readonly host: "dev.azure.com";
  readonly organization: string;
  readonly project: string;
}

export interface GitLabPackageSource extends PackageSourceBase {
  readonly provider: "gitlab";
  readonly host: string;
  readonly namespace: string;
}

export type PackageSource = GitHubPackageSource | AzureDevOpsPackageSource | GitLabPackageSource;

export interface MarketplacePackage {
  readonly manifest: PackageManifest;
  readonly sourcePath: string;
  readonly manifestPath: string;
  readonly hotload: boolean;
  readonly source: PackageSource;
  /** Immutable Git tree or commit revision used to read this package. */
  readonly sourceRevision?: string;
}

/** A successfully parsed repository source and the packages discovered in it. */
export interface SourceCatalogSnapshot {
  readonly source: PackageSource;
  readonly packages: readonly MarketplacePackage[];
}

export interface PackageFile {
  readonly relativePath: string;
  readonly content: Uint8Array;
}

export interface InstalledPackage {
  readonly id: string;
  readonly type: PackageType;
  readonly platform: Platform;
  readonly scope: InstallScope;
  readonly version: string;
  readonly sourceRepo: string;
  readonly sourceBranch: string;
  readonly sourcePath: string;
  readonly sourceId?: string;
  readonly qualifiedName?: string;
  readonly group?: string;
  readonly managedConfig?: ManagedConfigContribution;
  /** Managed global package payload retained for executable MCP lifecycle scripts. */
  readonly managedPayloadPath?: string;
  readonly installedPath: string;
  readonly installedAt: string;
  readonly hotloaded?: boolean;
  readonly hotloadRequestedAt?: string;
  readonly offloadRequestedAt?: string;
  readonly autoUpdate?: boolean;
  readonly autoUpdateChangedAt?: string;
  readonly sourceRevision?: string;
  readonly revertedAt?: string;
  readonly revertedFromVersion?: string;
  /** Immutable audit trail of explicit package identity migrations. */
  readonly migrationHistory?: readonly PackageMigrationHistoryEntry[];
}

export type McpScriptAction = "install" | "update" | "migrate" | "revert" | "uninstall";

export interface PackageMigrationSnapshot {
  readonly id: string;
  readonly qualifiedName: string;
  readonly sourceId?: string;
  readonly version: string;
  readonly repository: string;
  readonly branch: string;
  readonly path: string;
}

export interface PackageMigrationHistoryEntry {
  readonly migratedAt: string;
  readonly from: PackageMigrationSnapshot;
  readonly to: PackageMigrationSnapshot;
}

export type ManagedConfigContribution =
  | {
    readonly kind: "mcp";
    readonly serverName: string;
    readonly serverConfig: Readonly<Record<string, unknown>>;
  }
  | {
    readonly kind: "hook";
    readonly hooks: Readonly<Record<string, readonly unknown[]>>;
  }
  | {
    /** Marketplace-owned discovery file generated from a Codex agent package entrypoint. */
    readonly kind: "codex-agent";
    readonly configPath: string;
    readonly contentSha256: string;
  };

export interface InstalledState {
  readonly schemaVersion: 2;
  readonly packages: readonly InstalledPackage[];
}

export interface PlatformPathOverrides {
  readonly [platform: string]: {
    readonly [packageType: string]: string | undefined;
  } | undefined;
}

export interface MarketplaceConfig {
  readonly repository: string;
  readonly branch: string;
  readonly packageFolders: Readonly<Record<PackageType, string>>;
  readonly repositories?: readonly RepositoryConfig[];
  readonly platformPathOverrides: PlatformPathOverrides;
  readonly defaultPlatform: Platform;
  readonly autoUpdateEnabled?: boolean;
  readonly autoInstallGroups?: readonly string[];
}

export type MarketplaceAction =
  | "install"
  | "installGlobal"
  | "installCloud"
  | "installDifferentPlatform"
  | "uninstall"
  | "update"
  | "migrate"
  | "revert"
  | "hotload"
  | "offload";
