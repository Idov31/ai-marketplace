import type { CredentialProvider } from "../ports";
import type { MarketplaceConfig, MarketplacePackage, PackageFile, SourceCatalogSnapshot } from "../types/packages";
import { AzureDevOpsClient } from "./azureDevOpsClient";
import { GitHubClient } from "./githubClient";
import { GitLabClient } from "./gitLabClient";
import { repositorySources } from "./repositoryHttp";

export class RepositoryClient {
  private readonly github: GitHubClient;
  private readonly azureDevOps: AzureDevOpsClient;
  private readonly gitlab: GitLabClient;

  public constructor(config: MarketplaceConfig, credentials: CredentialProvider, log: (message: string) => void) {
    this.github = new GitHubClient(config, credentials, log);
    this.azureDevOps = new AzureDevOpsClient(config, credentials, log);
    this.gitlab = new GitLabClient(config, credentials, log);
    this.config = config;
  }

  private readonly config: MarketplaceConfig;

  public async checkConnection(): Promise<void> {
    await this.github.checkConnection();
    await this.azureDevOps.checkConnection();
    await this.gitlab.checkConnection();
  }

  public async listBranches(): Promise<readonly string[]> {
    const provider = repositorySources(this.config)[0]?.provider;
    return provider === "azure-devops" ? this.azureDevOps.listBranches() : provider === "gitlab" ? this.gitlab.listBranches() : this.github.listBranches();
  }

  public async listMarketplacePackages(
    onProgress?: (progress: RepositoryCatalogProgress) => void | Promise<void>
  ): Promise<readonly MarketplacePackage[]> {
    const completedPackages: MarketplacePackage[] = [];
    const onSourceComplete = async (snapshot: SourceCatalogSnapshot): Promise<void> => {
      completedPackages.push(...snapshot.packages);
      await onProgress?.({ ...snapshot, catalog: sortPackages(completedPackages) });
    };
    const results = await Promise.all([
      this.github.listMarketplacePackages(onSourceComplete),
      this.azureDevOps.listMarketplacePackages(onSourceComplete),
      this.gitlab.listMarketplacePackages(onSourceComplete)
    ]);
    return sortPackages(results.flat());
  }

  public fetchPackageFiles(pkg: MarketplacePackage): Promise<readonly PackageFile[]> {
    return pkg.source.provider === "azure-devops" ? this.azureDevOps.fetchPackageFiles(pkg)
      : pkg.source.provider === "gitlab" ? this.gitlab.fetchPackageFiles(pkg)
        : this.github.fetchPackageFiles(pkg);
  }

  public fetchPackageAtRevision(pkg: MarketplacePackage, revision: string): Promise<MarketplacePackage> {
    return pkg.source.provider === "azure-devops" ? this.azureDevOps.fetchPackageAtRevision(pkg, revision)
      : pkg.source.provider === "gitlab" ? this.gitlab.fetchPackageAtRevision(pkg, revision)
        : this.github.fetchPackageAtRevision(pkg, revision);
  }
}

export interface RepositoryCatalogProgress extends SourceCatalogSnapshot {
  /** Cumulative catalog from every repository source completed so far. */
  readonly catalog: readonly MarketplacePackage[];
}

function sortPackages(packages: readonly MarketplacePackage[]): readonly MarketplacePackage[] {
  return [...packages].sort((left, right) => `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`));
}
