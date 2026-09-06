import { TextDecoder } from "util";
import {
  type MarketplaceConfig,
  type MarketplacePackage,
  type PackageFile,
  type PackageSource,
  type RepositoryConfig,
  type GitHubRepositoryConfig,
  type SourceCatalogSnapshot
} from "../types/packages";
import type { CredentialProvider } from "../ports";
import { repoJoin, toPosixRelativePath } from "./pathPlanning";
import { parseMarketplaceYaml } from "./marketplaceYaml";
import { isManifestPath, selectManifestCandidates, selectManifestInFolder } from "./manifestSchema";
import { ManifestDiagnosticCollector } from "./manifestDiagnostics";
import { assertMcpScriptPaths } from "./mcpScripts";
import { parseHotloadFlag, validateMarketplaceManifest, validateMigrationSourceIdentity } from "./validation";
import { configuredSource, isFullGitRevision, packageSource, repositorySources, requestWithCredentials, safeReadErrorBody } from "./repositoryHttp";

interface GitHubBranch {
  readonly name?: string;
}

interface GitHubTreeItem {
  readonly path?: string;
  readonly type?: string;
  readonly sha?: string;
}

interface GitHubTreeResponse {
  readonly sha?: string;
  readonly tree?: readonly GitHubTreeItem[];
  readonly truncated?: boolean;
}

interface GitHubCommitResponse {
  readonly sha?: string;
  readonly tree?: { readonly sha?: string };
}

interface GitHubBlobResponse {
  readonly content?: string;
  readonly encoding?: string;
}

export class GitHubClient {
  private readonly decoder = new TextDecoder();
  private readonly treeCache = new Map<string, { readonly items: readonly GitHubTreeItem[]; readonly revision: string }>();

  public constructor(
    private readonly config: MarketplaceConfig,
    credentialsOrToken: CredentialProvider | string | undefined,
    private readonly log: (message: string) => void,
    sourceToken?: (source: RepositoryConfig) => Promise<string | undefined>
  ) {
    this.credentials = isCredentialProvider(credentialsOrToken)
      ? credentialsOrToken
      : legacyCredentialProvider(credentialsOrToken, sourceToken);
  }

  private readonly credentials: CredentialProvider;

  public async checkConnection(): Promise<void> {
    for (const source of this.sources()) {
      await this.getTree(source);
    }
  }

  public async listBranches(): Promise<readonly string[]> {
    const source = this.sources()[0];
    if (!source) {
      return [];
    }
    const branches = await this.requestJson<readonly GitHubBranch[]>(
      source,
      this.apiUrl(source, `/repos/${source.owner}/${source.repository}/branches`, { per_page: "100" })
    );
    return branches
      .map((branch) => branch.name)
      .filter((name): name is string => typeof name === "string" && name.length > 0)
      .sort((left, right) => left.localeCompare(right));
  }

  public async listMarketplacePackages(
    onSourceComplete?: (snapshot: SourceCatalogSnapshot) => void | Promise<void>
  ): Promise<readonly MarketplacePackage[]> {
    const results = await Promise.all(this.sources().map(async (source) => {
      const packages: MarketplacePackage[] = [];
      try {
        await this.listSourcePackages(source, packages);
      } catch (error) {
        this.log(`Unable to refresh source '${source.label}': ${error instanceof Error ? error.message : String(error)}`);
        return packages;
      }
      packages.sort((left, right) => `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`));
      this.log(`Finished parsing source '${source.label}': ${packages.length} package(s).`);
      await onSourceComplete?.({ source: packageSource(source), packages });
      return packages;
    }));
    return results.flat().sort((left, right) =>
      `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`)
    );
  }

  public async fetchPackageFiles(pkg: MarketplacePackage): Promise<readonly PackageFile[]> {
    const source = this.sourceForPackage(pkg.source);
    const tree = (await this.getTree(source, pkg.sourceRevision)).items;
    const sourcePrefix = stripLeadingSlash(repoJoin(pkg.sourcePath));
    const files: PackageFile[] = [];

    for (const item of tree) {
      if (!isBlob(item) || !item.path || !item.sha || !isWithinFolder(item.path, sourcePrefix)) {
        continue;
      }
      const relativePath = item.path.slice(sourcePrefix.length).replace(/^\/+/, "");
      files.push({
        relativePath: toPosixRelativePath(relativePath),
        content: await this.getBlobBytes(source, item.sha)
      });
    }
    return files;
  }

  /** Reads and validates the exact package snapshot selected by a manifest rollback revision. */
  public async fetchPackageAtRevision(pkg: MarketplacePackage, revision: string): Promise<MarketplacePackage> {
    if (!isFullGitRevision(revision)) {
      throw new Error("Rollback revision must be a full 40 or 64 character hexadecimal Git revision.");
    }
    const source = this.sourceForPackage(pkg.source);
    const commit = revision.toLowerCase();
    const treeResult = await this.getTree(source, await this.getCommitTreeSha(source, commit));
    this.treeCache.set(`${source.id}:${commit}`, treeResult);
    const selection = selectManifestInFolder(treeResult.items.flatMap((item) => isBlob(item) && item.path ? [item.path] : []), stripLeadingSlash(pkg.sourcePath));
    if (!selection) throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    const manifestPath = selection.path;
    const manifestItem = treeResult.items.find((item) => item.path === manifestPath && isBlob(item));
    if (!manifestItem?.sha) {
      throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    }
    const manifest = validateMarketplaceManifest(parseMarketplaceYaml(this.decoder.decode(await this.getBlobBytes(source, manifestItem.sha)), manifestPath), manifestPath).manifest;
    validateMigrationSourceIdentity(manifest, source.id, manifestPath);
    const sourcePath = selection.sourcePath;
    if (sourcePath !== pkg.sourcePath
      || manifest.id !== pkg.manifest.id
      || manifest.qualifiedName !== pkg.manifest.qualifiedName
      || manifest.type !== pkg.manifest.type) {
      throw new Error("Rollback snapshot does not match the configured package source, path, identity, and type.");
    }
    if (manifest.type === "mcp") assertMcpScriptPaths(manifestPath, packageRelativeBlobPaths(treeResult.items, sourcePath));
    const entrypoint = await this.getText(source, repoJoin(sourcePath, manifest.entrypoint), undefined, treeResult.items);
    return {
      manifest,
      sourcePath,
      manifestPath,
      hotload: parseHotloadFlag(entrypoint),
      source: packageSource(source),
      sourceRevision: commit
    };
  }

  private async listSourcePackages(source: GitHubRepositoryConfig, packages: MarketplacePackage[]): Promise<void> {
    const treeResult = await this.getTree(source);
    const tree = treeResult.items;
    const diagnostics = new ManifestDiagnosticCollector();
    for (const [type, folder] of Object.entries(source.packageFolders)) {
      const root = stripLeadingSlash(repoJoin(folder));
      const items = tree.filter((item) => isWithinFolder(item.path, root));
      const selections = selectManifestCandidates(items.flatMap((item) => isBlob(item) && item.path && isManifestPath(item.path) ? [item.path] : []));
      this.log(`Source ${source.id} package folder ${root}: ${items.length} item(s), ${selections.length} AI Marketplace manifest candidate(s).`);

      for (const selection of selections) {
        const item = items.find((candidate) => candidate.path === selection.path && isBlob(candidate));
        if (!item?.path) continue;
        try {
          const manifestText = await this.getText(source, item.path);
          const validated = validateMarketplaceManifest(parseMarketplaceYaml(manifestText, item.path), item.path);
          const manifest = validated.manifest;
          diagnostics.record(validated.diagnostics);
          validateMigrationSourceIdentity(manifest, source.id, item.path);
          if (manifest.type !== type) {
            this.log(`Skipping ${item.path}: manifest type does not match containing folder.`);
            continue;
          }
          const sourcePath = selection.sourcePath;
          if (manifest.type === "mcp") assertMcpScriptPaths(item.path, packageRelativeBlobPaths(tree, sourcePath));
          const entrypointContent = await this.getText(source, repoJoin(sourcePath, manifest.entrypoint));
          packages.push({
            manifest,
            sourcePath,
            manifestPath: item.path,
            hotload: parseHotloadFlag(entrypointContent),
            source: packageSource(source),
            ...(treeResult.revision === undefined ? {} : { sourceRevision: treeResult.revision })
          });
          this.log(`Loaded package ${manifest.qualifiedName} (${manifest.type}) from source ${source.id} at ${item.path}.`);
        } catch (error) {
          this.log(`Skipping invalid package at ${item.path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    const summary = diagnostics.summary(source.label);
    if (summary) this.log(summary);
  }

  private async getTree(source: GitHubRepositoryConfig, revision = source.branch): Promise<{ readonly items: readonly GitHubTreeItem[]; readonly revision: string }> {
    const cacheKey = `${source.id}:${revision}`;
    const cached = this.treeCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    this.log(`Listing GitHub tree: source=${source.id}, repo=${source.owner}/${source.repository}, branch=${source.branch}`);
    const tree = await this.requestJson<GitHubTreeResponse>(
      source,
      this.apiUrl(source, `/repos/${source.owner}/${source.repository}/git/trees/${encodeURIComponent(revision)}`, {
        recursive: "1"
      })
    );
    if (tree.truncated) {
      throw new Error(`GitHub repository tree is truncated for source '${source.id}'; its catalog is too large to load safely.`);
    }
    if (!isFullGitRevision(tree.sha ?? "")) {
      throw new Error(`GitHub tree for source '${source.id}' did not return an immutable revision SHA.`);
    }
    const result = { items: tree.tree ?? [], revision: tree.sha!.toLowerCase() };
    this.treeCache.set(cacheKey, result);
    return result;
  }

  private async getCommitTreeSha(source: GitHubRepositoryConfig, revision: string): Promise<string> {
    const commit = await this.requestJson<GitHubCommitResponse>(
      source,
      this.apiUrl(source, `/repos/${source.owner}/${source.repository}/git/commits/${encodeURIComponent(revision)}`, {})
    );
    if (typeof commit.sha !== "string" || commit.sha.toLowerCase() !== revision || !isFullGitRevision(commit.tree?.sha ?? "")) {
      throw new Error(`Rollback revision '${revision}' is not an exact Git commit with a valid tree.`);
    }
    return commit.tree!.sha!.toLowerCase();
  }

  private async getText(source: GitHubRepositoryConfig, path: string, revision?: string, providedTree?: readonly GitHubTreeItem[]): Promise<string> {
    const tree = providedTree ?? (await this.getTree(source, revision)).items;
    const normalized = stripLeadingSlash(repoJoin(path));
    const item = tree.find((candidate) => candidate.path === normalized && isBlob(candidate));
    if (!item?.sha) {
      throw new GitHubRequestError(404, "Not Found", "", `source=${source.id}, path=${path}, branch=${source.branch}`);
    }
    return this.decoder.decode(await this.getBlobBytes(source, item.sha));
  }

  private async getBlobBytes(source: GitHubRepositoryConfig, sha: string): Promise<Uint8Array> {
    const blob = await this.requestJson<GitHubBlobResponse>(
      source,
      this.apiUrl(source, `/repos/${source.owner}/${source.repository}/git/blobs/${encodeURIComponent(sha)}`, {})
    );
    if (blob.encoding !== "base64" || typeof blob.content !== "string") {
      throw new Error(`GitHub blob ${sha} did not return base64 content.`);
    }
    return new Uint8Array(Buffer.from(blob.content.replace(/\s+/g, ""), "base64"));
  }

  private async requestJson<T>(source: GitHubRepositoryConfig, url: string): Promise<T> {
    const response = await this.request(source, url);
    if (!response.ok) {
      throw new GitHubRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest(url));
    }
    return await response.json() as T;
  }

  private async request(source: GitHubRepositoryConfig, url: string): Promise<Response> {
    return requestWithCredentials({
      source,
      url,
      accept: "application/vnd.github+json",
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
      credentials: this.credentials,
      log: this.log
    });
  }

  private apiUrl(_source: GitHubRepositoryConfig, route: string, params: Readonly<Record<string, string>>): string {
    const url = new URL(`https://api.github.com${route}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private sources(): readonly Extract<RepositoryConfig, { readonly provider: "github" }>[] {
    return repositorySources(this.config).filter((source): source is Extract<RepositoryConfig, { readonly provider: "github" }> => source.provider === "github");
  }

  private sourceForPackage(source: PackageSource): GitHubRepositoryConfig {
    if (source.provider !== "github") throw new Error(`Package source '${source.id}' is not a GitHub source.`);
    return configuredSource(this.config, source) as Extract<RepositoryConfig, { readonly provider: "github" }>;
  }
}

export class GitHubRequestError extends Error {
  public constructor(
    public readonly status: number,
    statusText: string,
    public readonly body: string,
    requestDescription: string
  ) {
    super(`GitHub request failed: ${status} ${statusText}${body ? ` - ${body}` : ""} (${requestDescription})`);
    this.name = "GitHubRequestError";
  }
}

function isBlob(item: GitHubTreeItem): boolean {
  return item.type === "blob";
}

function packageRelativeBlobPaths(items: readonly GitHubTreeItem[], sourcePath: string): ReadonlySet<string> {
  const prefix = `${stripLeadingSlash(sourcePath)}/`;
  return new Set(items.flatMap((item) => isBlob(item) && item.path?.startsWith(prefix) ? [item.path.slice(prefix.length)] : []));
}

function isWithinFolder(pathValue: string | undefined, folder: string): boolean {
  return typeof pathValue === "string" && (pathValue === folder || pathValue.startsWith(`${folder}/`));
}

function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

function describeRequest(rawUrl: string): string {
  const url = new URL(rawUrl);
  return `route=${url.pathname}`;
}

function isCredentialProvider(value: CredentialProvider | string | undefined): value is CredentialProvider {
  return typeof value === "object" && value !== null && "sharedCredentials" in value;
}

function legacyCredentialProvider(
  token: string | undefined,
  sourceToken?: (source: RepositoryConfig) => Promise<string | undefined>
): CredentialProvider {
  return {
    sharedCredentials: async (provider) => provider === "github" && token ? [{ kind: "bearer", token }] : [],
    sourceCredentials: async (source) => {
      const value = sourceToken ? await sourceToken(source) : undefined;
      return source.provider === "github" && value ? [{ kind: "bearer", token: value }] : [];
    }
  };
}
