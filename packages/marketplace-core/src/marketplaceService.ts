import type { InstallScope, InstalledPackage, MarketplaceConfig, MarketplacePackage, Platform } from "./types/packages";
import type { CredentialProvider, MarketplaceConfigProvider, MarketplaceLogger, MarketplaceStorage, McpScriptRunner } from "./ports";
import { RepositoryClient } from "./services/repositoryClient";
import { PackageInstaller } from "./services/packageInstaller";
import { toSerializableMarketplaceModel, type SerializableMarketplaceModel } from "./services/marketplaceModel";
import { discoverInstalledPackages, type AutoDiscoveryOptions } from "./services/autoDiscovery";
import { autoInstallGroupPlans, planGroupInstall, type GroupInstallScope } from "./services/groupInstall";
import { defaultPackageInstallPlans } from "./services/defaultPackages";
import { isUpdateAvailable } from "./services/versioning";
import { planBulkInstall, planBulkUninstall, type BulkInstallCandidate, type BulkInstallPlan, type BulkUninstallCandidate, type BulkUninstallPlan } from "./services/bulkPlanning";
import { migrationFor, planPackageMigrations, type MigrationPlan } from "./services/migrationPlanning";

export interface MarketplaceServiceDependencies {
  readonly storage: MarketplaceStorage;
  readonly configuration: MarketplaceConfigProvider;
  readonly credentials: CredentialProvider;
  readonly logger: MarketplaceLogger;
  readonly mcpScriptRunner?: McpScriptRunner;
}

export type SyncAction =
  | { readonly kind: "install-default" | "install-group"; readonly pkg: MarketplacePackage; readonly platform: Platform; readonly scope: "global" }
  | { readonly kind: "update"; readonly pkg: MarketplacePackage; readonly installed: InstalledPackage };

export interface SyncPlan { readonly actions: readonly SyncAction[]; }

/** Host-neutral application facade shared by the VS Code and Codex adapters. */
export class MarketplaceService {
  private catalog: readonly MarketplacePackage[] = [];

  public constructor(private readonly dependencies: MarketplaceServiceDependencies) {}

  public async refreshCatalog(): Promise<readonly MarketplacePackage[]> {
    const client = this.repositoryClient();
    this.catalog = await client.listMarketplacePackages();
    return this.catalog;
  }

  public getCatalog(): readonly MarketplacePackage[] {
    return this.catalog;
  }

  public async listInstalled(): Promise<readonly InstalledPackage[]> {
    return (await this.installer()).listInstalled();
  }

  public async diagnose(): Promise<{ readonly connected: true; readonly packageCount: number }> {
    const client = this.repositoryClient();
    await client.checkConnection();
    const packages = await client.listMarketplacePackages();
    return { connected: true, packageCount: packages.length };
  }

  public async discover(options: Omit<AutoDiscoveryOptions, "catalog" | "existing" | "config">): Promise<readonly InstalledPackage[]> {
    return discoverInstalledPackages({ ...options, catalog: this.catalog, existing: await this.listInstalled(), config: this.config() });
  }

  public async planGroup(group: string, scope: GroupInstallScope) {
    return planGroupInstall(group, scope, this.catalog, await this.listInstalled(), this.config().defaultPlatform);
  }

  public planBulkInstall(candidates: readonly BulkInstallCandidate[], scope: "workspace" | "global"): BulkInstallPlan {
    return planBulkInstall(candidates, scope);
  }

  public planBulkUninstall(candidates: readonly BulkUninstallCandidate[], scope: InstallScope): BulkUninstallPlan {
    return planBulkUninstall(candidates, scope);
  }

  public async syncPlan(): Promise<SyncPlan> {
    const installed = await this.listInstalled();
    const config = this.config();
    const actions: SyncAction[] = [
      ...defaultPackageInstallPlans(this.catalog, installed, config.defaultPlatform, config).map((item): SyncAction => ({ kind: "install-default", ...item, scope: "global" })),
      ...autoInstallGroupPlans(this.catalog, installed, config.autoInstallGroups ?? [], config.defaultPlatform).map((item): SyncAction => ({ kind: "install-group", ...item, scope: "global" }))
    ];
    if (config.autoUpdateEnabled) {
      for (const current of installed) {
        if (current.autoUpdate === false) continue;
        const pkg = this.catalog.find((candidate) => candidate.source.id === current.sourceId && candidate.manifest.qualifiedName === current.qualifiedName);
        if (pkg && isUpdateAvailable(current.version, pkg.manifest.version)) {
          actions.push({ kind: "update", pkg, installed: current });
        }
      }
    }
    return { actions: deduplicateSyncActions(actions) };
  }

  public async applySync(requestedPlan?: SyncPlan): Promise<readonly InstalledPackage[]> {
    const plan = requestedPlan ?? await this.syncPlan();
    const applied: InstalledPackage[] = [];
    for (const action of plan.actions) {
      applied.push(action.kind === "update"
        ? await this.update(action.pkg, action.installed)
        : await this.install(action.pkg, action.platform, action.scope));
    }
    return applied;
  }

  public async getMarketplaceModel(): Promise<SerializableMarketplaceModel> {
    const installed = await this.listInstalled();
    const config = this.config();
    return toSerializableMarketplaceModel({
      packages: this.catalog,
      installed,
      configured: true,
      autoUpdateEnabled: config.autoUpdateEnabled ?? false,
      autoInstallGroups: config.autoInstallGroups,
      defaultPlatform: config.defaultPlatform
    });
  }

  public async install(pkg: MarketplacePackage, platform: Platform, scope: InstallScope): Promise<InstalledPackage> {
    return (await this.installer()).install(pkg, platform, scope);
  }

  public async update(pkg: MarketplacePackage, installed: InstalledPackage): Promise<InstalledPackage> {
    return (await this.installer()).updateInstalled(pkg, installed);
  }

  public async planMigrations(): Promise<MigrationPlan> {
    return planPackageMigrations(this.catalog, await this.listInstalled());
  }

  public async migrate(destination: MarketplacePackage, predecessor: InstalledPackage): Promise<InstalledPackage> {
    const installed = await this.listInstalled();
    if (!migrationFor(destination, predecessor, this.catalog, installed)) throw new Error("The selected package migration is not eligible.");
    return (await this.installer()).migrateInstalled(destination, predecessor);
  }

  public async revert(pkg: MarketplacePackage, installed: InstalledPackage, revision: string): Promise<InstalledPackage> {
    const snapshot = await this.repositoryClient().fetchPackageAtRevision(pkg, revision);
    return (await this.installer()).revertInstalled(snapshot, installed, revision);
  }

  public async uninstall(installed: InstalledPackage): Promise<void> {
    await (await this.installer()).uninstall(installed);
  }

  public async hotload(installed: InstalledPackage): Promise<InstalledPackage> {
    return (await this.installer()).hotload(installed);
  }

  public async offload(installed: InstalledPackage): Promise<InstalledPackage> {
    return (await this.installer()).offload(installed);
  }

  private config(): MarketplaceConfig {
    return this.dependencies.configuration.read();
  }

  private repositoryClient(): RepositoryClient {
    return new RepositoryClient(
      this.config(),
      this.dependencies.credentials,
      (message) => this.dependencies.logger.log(message)
    );
  }

  private async installer(): Promise<PackageInstaller> {
    const client = this.repositoryClient();
    return new PackageInstaller(this.dependencies.storage, this.config(), (pkg) => client.fetchPackageFiles(pkg), this.dependencies.mcpScriptRunner);
  }
}

function deduplicateSyncActions(actions: readonly SyncAction[]): readonly SyncAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.pkg.source.id}:${action.pkg.manifest.qualifiedName}:${action.kind === "update" ? `${action.installed.platform}:${action.installed.scope}` : `${action.platform}:${action.scope}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
