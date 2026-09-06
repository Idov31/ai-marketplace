import { TextDecoder } from "node:util";
import type { CredentialProvider } from "../ports";
import type { AzureDevOpsRepositoryConfig, MarketplaceConfig, MarketplacePackage, PackageFile, PackageSource, SourceCatalogSnapshot } from "../types/packages";
import { repoJoin, toPosixRelativePath } from "./pathPlanning";
import { parseMarketplaceYaml } from "./marketplaceYaml";
import { isManifestPath, selectManifestCandidates, selectManifestInFolder } from "./manifestSchema";
import { ManifestDiagnosticCollector } from "./manifestDiagnostics";
import { assertMcpScriptPaths } from "./mcpScripts";
import { parseHotloadFlag, validateMarketplaceManifest, validateMigrationSourceIdentity } from "./validation";
import { configuredSource, isAuthenticationFailureResponse, isFullGitRevision, packageSource, repositorySources, requestWithCredentials, safeReadErrorBody, describeRequest } from "./repositoryHttp";

interface AzureItem { readonly path?: string; readonly gitObjectType?: string; readonly isFolder?: boolean; }
interface AzureListResponse { readonly value?: readonly AzureItem[]; }
interface AzureRef { readonly name?: string; readonly objectId?: string; }
interface AzureRefsResponse { readonly value?: readonly AzureRef[]; }
interface AzureCommit { readonly commitId?: string; }

export class AzureDevOpsClient {
  private readonly decoder = new TextDecoder();
  private readonly loggedCredentialFallbacks = new Set<string>();

  public constructor(
    private readonly config: MarketplaceConfig,
    private readonly credentials: CredentialProvider,
    private readonly log: (message: string) => void
  ) {}

  public async checkConnection(): Promise<void> {
    for (const source of this.sources()) await this.resolveSourceRevision(source);
  }

  public async listBranches(): Promise<readonly string[]> {
    const source = this.sources()[0];
    if (!source) return [];
    const json = await this.requestJson<AzureRefsResponse>(source, this.buildUrl(source, "/refs", { filter: "heads/", "api-version": "7.1" }));
    return (json.value ?? []).map((ref) => ref.name?.replace(/^refs\/heads\//, ""))
      .filter((name): name is string => Boolean(name)).sort((left, right) => left.localeCompare(right));
  }

  public async listMarketplacePackages(
    onSourceComplete?: (snapshot: SourceCatalogSnapshot) => void | Promise<void>
  ): Promise<readonly MarketplacePackage[]> {
    const results = await Promise.all(this.sources().map(async (source) => {
      const packages: MarketplacePackage[] = [];
      try { await this.listSourcePackages(source, packages); }
      catch (error) { this.log(`Unable to refresh source '${source.label}': ${message(error)}`); return packages; }
      packages.sort(comparePackages);
      this.log(`Finished parsing source '${source.label}': ${packages.length} package(s).`);
      await onSourceComplete?.({ source: packageSource(source), packages });
      return packages;
    }));
    return results.flat().sort(comparePackages);
  }

  public async fetchPackageFiles(pkg: MarketplacePackage): Promise<readonly PackageFile[]> {
    const source = this.sourceForPackage(pkg.source);
    const items = await this.listItems(source, pkg.sourcePath, { revision: pkg.sourceRevision });
    const files: PackageFile[] = [];
    for (const item of items) {
      if (!isFile(item) || !item.path) continue;
      const relativePath = item.path.slice(pkg.sourcePath.length).replace(/^\/+/, "");
      files.push({ relativePath: toPosixRelativePath(relativePath), content: await this.getBytes(source, item.path, pkg.sourceRevision) });
    }
    return files;
  }

  public async fetchPackageAtRevision(pkg: MarketplacePackage, revision: string): Promise<MarketplacePackage> {
    if (!isFullGitRevision(revision) || revision.length !== 40) throw new Error("Rollback revision must be a full 40 character hexadecimal Git revision.");
    const source = this.sourceForPackage(pkg.source);
    const commit = revision.toLowerCase();
    await this.validateCommit(source, commit);
    const items = await this.listItems(source, pkg.sourcePath, { revision: commit });
    const selection = selectManifestInFolder(items.flatMap((item) => isFile(item) && item.path ? [item.path] : []), pkg.sourcePath);
    if (!selection) throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    const manifestText = await this.getText(source, selection.path, commit);
    const manifest = validateMarketplaceManifest(parseMarketplaceYaml(manifestText, selection.path), selection.path).manifest;
    validateMigrationSourceIdentity(manifest, source.id, selection.path);
    const sourcePath = selection.sourcePath;
    if (sourcePath !== pkg.sourcePath || manifest.id !== pkg.manifest.id || manifest.qualifiedName !== pkg.manifest.qualifiedName || manifest.type !== pkg.manifest.type) {
      throw new Error("Rollback snapshot does not match the configured package source, path, identity, and type.");
    }
    if (manifest.type === "mcp") assertMcpScriptPaths(selection.path, packageRelativePaths(items, sourcePath));
    const entrypoint = await this.getText(source, repoJoin(sourcePath, manifest.entrypoint), commit);
    return { manifest, sourcePath, manifestPath: selection.path, hotload: parseHotloadFlag(entrypoint), source: packageSource(source), sourceRevision: commit };
  }

  private async listSourcePackages(source: AzureDevOpsRepositoryConfig, packages: MarketplacePackage[]): Promise<void> {
    const revision = await this.resolveSourceRevision(source);
    const diagnostics = new ManifestDiagnosticCollector();
    for (const [type, folder] of Object.entries(source.packageFolders)) {
      const root = repoJoin(folder);
      const items = await this.listItems(source, root, { allowMissingFolder: true, revision });
      const selections = selectManifestCandidates(items.flatMap((item) => isFile(item) && item.path && isManifestPath(item.path) ? [item.path] : []));
      this.log(`Source ${source.id} package folder ${root}: ${items.length} item(s), ${selections.length} AI Marketplace manifest candidate(s).`);
      for (const selection of selections) {
        const item = items.find((candidate) => candidate.path === selection.path && isFile(candidate));
        if (!item?.path) continue;
        try {
          const validated = validateMarketplaceManifest(parseMarketplaceYaml(await this.getText(source, item.path, revision), item.path), item.path);
          const manifest = validated.manifest;
          diagnostics.record(validated.diagnostics);
          validateMigrationSourceIdentity(manifest, source.id, item.path);
          if (manifest.type !== type) { this.log(`Skipping ${item.path}: manifest type does not match containing folder.`); continue; }
          const sourcePath = selection.sourcePath;
          if (manifest.type === "mcp") assertMcpScriptPaths(item.path, packageRelativePaths(items, sourcePath));
          const entrypoint = await this.getText(source, repoJoin(sourcePath, manifest.entrypoint), revision);
          packages.push({ manifest, sourcePath, manifestPath: item.path, hotload: parseHotloadFlag(entrypoint), source: packageSource(source), sourceRevision: revision });
          this.log(`Loaded package ${manifest.qualifiedName} (${manifest.type}) from source ${source.id} at ${item.path}.`);
        } catch (error) { this.log(`Skipping invalid package at ${item.path}: ${message(error)}`); }
      }
    }
    const summary = diagnostics.summary(source.label);
    if (summary) this.log(summary);
  }

  private async resolveSourceRevision(source: AzureDevOpsRepositoryConfig): Promise<string> {
    const json = await this.requestJson<AzureRefsResponse>(source, this.buildUrl(source, "/refs", { filter: `heads/${source.branch}`, "api-version": "7.1" }));
    const revision = json.value?.find((ref) => ref.name === `refs/heads/${source.branch}`)?.objectId;
    if (!revision || !/^[0-9a-f]{40}$/i.test(revision)) throw new Error(`Configured source '${source.id}' did not return an immutable commit for branch '${source.branch}'.`);
    return revision.toLowerCase();
  }

  private async validateCommit(source: AzureDevOpsRepositoryConfig, revision: string): Promise<void> {
    const commit = await this.requestJson<AzureCommit>(source, this.buildUrl(source, `/commits/${encodeURIComponent(revision)}`, { "api-version": "7.1" }));
    if (commit.commitId?.toLowerCase() !== revision) throw new Error(`Rollback revision '${revision}' is not an exact Git commit.`);
  }

  private async listItems(source: AzureDevOpsRepositoryConfig, scopePath: string, options: { readonly allowMissingFolder?: boolean; readonly revision?: string } = {}): Promise<readonly AzureItem[]> {
    const revision = options.revision ?? source.branch;
    const url = this.buildUrl(source, "/items", {
      scopePath, recursionLevel: "Full", includeContentMetadata: "true",
      "versionDescriptor.version": revision,
      "versionDescriptor.versionType": options.revision ? "commit" : "branch",
      "api-version": "7.1"
    });
    try { return (await this.requestJson<AzureListResponse>(source, url)).value ?? []; }
    catch (error) {
      if (options.allowMissingFolder && isMissingPathError(error)) { this.log(`Skipping missing package folder ${scopePath}.`); return []; }
      throw error;
    }
  }

  private async getText(source: AzureDevOpsRepositoryConfig, path: string, revision?: string): Promise<string> {
    return this.decoder.decode(await this.getBytes(source, path, revision));
  }

  private async getBytes(source: AzureDevOpsRepositoryConfig, path: string, revision?: string): Promise<Uint8Array> {
    const url = this.buildUrl(source, "/items", {
      path, download: "true", "versionDescriptor.version": revision ?? source.branch,
      "versionDescriptor.versionType": revision ? "commit" : "branch", "api-version": "7.1"
    });
    const response = await requestWithCredentials({ source, url, accept: "*/*", credentials: this.credentials, log: (line) => this.logRequest(source, line) });
    if (isAuthenticationFailureResponse(response, source.provider)) throw authenticationError(response, url);
    if (!response.ok) throw new AzureDevOpsRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest(url));
    return new Uint8Array(await response.arrayBuffer());
  }

  private async requestJson<T>(source: AzureDevOpsRepositoryConfig, url: string): Promise<T> {
    const response = await requestWithCredentials({ source, url, credentials: this.credentials, log: (line) => this.logRequest(source, line) });
    if (isAuthenticationFailureResponse(response, source.provider)) throw authenticationError(response, url);
    if (!response.ok) throw new AzureDevOpsRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest(url));
    try { return await response.json() as T; }
    catch { throw new AzureDevOpsRequestError(response.status, response.statusText, "Azure DevOps returned a non-JSON response.", describeRequest(url)); }
  }

  private buildUrl(source: AzureDevOpsRepositoryConfig, route: string, params: Readonly<Record<string, string>>): string {
    const url = new URL(`https://dev.azure.com/${encodeURIComponent(source.organization)}/${encodeURIComponent(source.project)}/_apis/git/repositories/${encodeURIComponent(source.repository)}${route}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }

  private sources(): readonly AzureDevOpsRepositoryConfig[] {
    return repositorySources(this.config).filter((source): source is AzureDevOpsRepositoryConfig => source.provider === "azure-devops");
  }

  private sourceForPackage(source: PackageSource): AzureDevOpsRepositoryConfig {
    if (source.provider !== "azure-devops") throw new Error(`Package source '${source.id}' is not an Azure DevOps source.`);
    return configuredSource(this.config, source) as AzureDevOpsRepositoryConfig;
  }

  private logRequest(source: AzureDevOpsRepositoryConfig, line: string): void {
    if (line.startsWith("Retrying Azure DevOps request with a repository-specific credential")) {
      if (this.loggedCredentialFallbacks.has(source.id)) return;
      this.loggedCredentialFallbacks.add(source.id);
    }
    this.log(line);
  }
}

export class AzureDevOpsRequestError extends Error {
  public constructor(public readonly status: number, statusText: string, public readonly body: string, request: string) {
    super(`Azure DevOps request failed: ${status} ${statusText}${body ? ` - ${body}` : ""} (${request})`);
    this.name = "AzureDevOpsRequestError";
  }
}

function isFile(item: AzureItem): boolean { return item.gitObjectType === "blob" || item.isFolder === false; }
function packageRelativePaths(items: readonly AzureItem[], sourcePath: string): ReadonlySet<string> { const prefix = `${sourcePath}/`; return new Set(items.flatMap((item) => isFile(item) && item.path?.startsWith(prefix) ? [item.path.slice(prefix.length)] : [])); }
function isMissingPathError(error: unknown): boolean { return error instanceof AzureDevOpsRequestError && (error.status === 400 || error.status === 404) && /tf401174|could not be found|not found/i.test(error.body); }
function authenticationError(response: Response, url: string): AzureDevOpsRequestError {
  return new AzureDevOpsRequestError(response.status, response.statusText, "Authentication was rejected or redirected to the Azure DevOps sign-in page. Verify the selected OAuth/PAT credential type and repository access.", describeRequest(url));
}
function comparePackages(left: MarketplacePackage, right: MarketplacePackage): number { return `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
