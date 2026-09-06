import { TextDecoder } from "node:util";
import type { CredentialProvider } from "../ports";
import type { GitLabRepositoryConfig, MarketplaceConfig, MarketplacePackage, PackageFile, PackageSource, SourceCatalogSnapshot } from "../types/packages";
import { repoJoin, toPosixRelativePath } from "./pathPlanning";
import { parseMarketplaceYaml } from "./marketplaceYaml";
import { isManifestPath, selectManifestCandidates, selectManifestInFolder } from "./manifestSchema";
import { ManifestDiagnosticCollector } from "./manifestDiagnostics";
import { assertMcpScriptPaths } from "./mcpScripts";
import { parseHotloadFlag, validateMarketplaceManifest, validateMigrationSourceIdentity } from "./validation";
import { configuredSource, describeRequest, isFullGitRevision, packageSource, repositorySources, requestWithCredentials, safeReadErrorBody } from "./repositoryHttp";

interface GitLabTreeItem { readonly id?: string; readonly path?: string; readonly type?: string; }
interface GitLabBlob { readonly content?: string; readonly encoding?: string; readonly sha?: string; }
interface GitLabCommit { readonly id?: string; }
interface GitLabBranch { readonly name?: string; }

export class GitLabClient {
  private readonly decoder = new TextDecoder();
  private readonly treeCache = new Map<string, readonly GitLabTreeItem[]>();

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
    const values = await this.requestPaged<GitLabBranch>(source, this.apiUrl(source, "/repository/branches", { per_page: "100" }));
    return values.map((branch) => branch.name).filter((name): name is string => Boolean(name)).sort((a, b) => a.localeCompare(b));
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
    const revision = pkg.sourceRevision ?? source.branch;
    const tree = await this.getTree(source, revision);
    const prefix = stripSlash(pkg.sourcePath);
    const files: PackageFile[] = [];
    for (const item of tree) {
      if (!isBlob(item) || !item.id || !item.path || !isWithin(item.path, prefix)) continue;
      files.push({ relativePath: toPosixRelativePath(item.path.slice(prefix.length).replace(/^\/+/, "")), content: await this.getBlobBytes(source, item.id) });
    }
    return files;
  }

  public async fetchPackageAtRevision(pkg: MarketplacePackage, revision: string): Promise<MarketplacePackage> {
    if (!isFullGitRevision(revision) || revision.length !== 40) throw new Error("Rollback revision must be a full 40 character hexadecimal Git revision.");
    const source = this.sourceForPackage(pkg.source);
    const commit = revision.toLowerCase();
    await this.validateCommit(source, commit);
    const tree = await this.getTree(source, commit);
    const selection = selectManifestInFolder(tree.flatMap((item) => isBlob(item) && item.path ? [item.path] : []), stripSlash(pkg.sourcePath));
    if (!selection) throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    const manifestPath = selection.path;
    const manifestItem = tree.find((item) => isBlob(item) && item.path === manifestPath);
    if (!manifestItem?.id) throw new Error(`Rollback revision '${revision}' does not contain an AI Marketplace manifest in '${pkg.sourcePath}'.`);
    const manifest = validateMarketplaceManifest(parseMarketplaceYaml(this.decoder.decode(await this.getBlobBytes(source, manifestItem.id)), manifestPath), manifestPath).manifest;
    validateMigrationSourceIdentity(manifest, source.id, manifestPath);
    const sourcePath = selection.sourcePath;
    if (sourcePath !== stripSlash(pkg.sourcePath) || manifest.id !== pkg.manifest.id || manifest.qualifiedName !== pkg.manifest.qualifiedName || manifest.type !== pkg.manifest.type) {
      throw new Error("Rollback snapshot does not match the configured package source, path, identity, and type.");
    }
    if (manifest.type === "mcp") assertMcpScriptPaths(manifestPath, packageRelativePaths(tree, sourcePath));
    const entrypoint = await this.getTextFromTree(source, tree, repoJoin(sourcePath, manifest.entrypoint));
    return { manifest, sourcePath, manifestPath, hotload: parseHotloadFlag(entrypoint), source: packageSource(source), sourceRevision: commit };
  }

  private async listSourcePackages(source: GitLabRepositoryConfig, packages: MarketplacePackage[]): Promise<void> {
    const revision = await this.resolveSourceRevision(source);
    const tree = await this.getTree(source, revision);
    const diagnostics = new ManifestDiagnosticCollector();
    for (const [type, folder] of Object.entries(source.packageFolders)) {
      const root = stripSlash(repoJoin(folder));
      const items = tree.filter((item) => isWithin(item.path, root));
      const selections = selectManifestCandidates(items.flatMap((item) => isBlob(item) && item.path && isManifestPath(item.path) ? [item.path] : []));
      this.log(`Source ${source.id} package folder ${root}: ${items.length} item(s), ${selections.length} AI Marketplace manifest candidate(s).`);
      for (const selection of selections) {
        const item = items.find((candidate) => candidate.path === selection.path && isBlob(candidate));
        if (!item?.path || !item.id) continue;
        try {
          const validated = validateMarketplaceManifest(parseMarketplaceYaml(this.decoder.decode(await this.getBlobBytes(source, item.id)), item.path), item.path);
          const manifest = validated.manifest;
          diagnostics.record(validated.diagnostics);
          validateMigrationSourceIdentity(manifest, source.id, item.path);
          if (manifest.type !== type) { this.log(`Skipping ${item.path}: manifest type does not match containing folder.`); continue; }
          const sourcePath = selection.sourcePath;
          if (manifest.type === "mcp") assertMcpScriptPaths(item.path, packageRelativePaths(tree, sourcePath));
          const entrypoint = await this.getTextFromTree(source, tree, repoJoin(sourcePath, manifest.entrypoint));
          packages.push({ manifest, sourcePath, manifestPath: item.path, hotload: parseHotloadFlag(entrypoint), source: packageSource(source), sourceRevision: revision });
          this.log(`Loaded package ${manifest.qualifiedName} (${manifest.type}) from source ${source.id} at ${item.path}.`);
        } catch (error) { this.log(`Skipping invalid package at ${item.path}: ${message(error)}`); }
      }
    }
    const summary = diagnostics.summary(source.label);
    if (summary) this.log(summary);
  }

  private async resolveSourceRevision(source: GitLabRepositoryConfig): Promise<string> {
    const commit = await this.requestJson<GitLabCommit>(source, this.apiUrl(source, `/repository/commits/${encodeURIComponent(source.branch)}`, { stats: "false" }));
    if (!commit.id || !/^[0-9a-f]{40}$/i.test(commit.id)) throw new Error(`Configured source '${source.id}' did not return an immutable commit for branch '${source.branch}'.`);
    return commit.id.toLowerCase();
  }

  private async validateCommit(source: GitLabRepositoryConfig, revision: string): Promise<void> {
    const commit = await this.requestJson<GitLabCommit>(source, this.apiUrl(source, `/repository/commits/${encodeURIComponent(revision)}`, { stats: "false" }));
    if (commit.id?.toLowerCase() !== revision) throw new Error(`Rollback revision '${revision}' is not an exact Git commit.`);
  }

  private async getTree(source: GitLabRepositoryConfig, revision: string): Promise<readonly GitLabTreeItem[]> {
    const key = `${source.id}:${revision}`;
    const cached = this.treeCache.get(key);
    if (cached) return cached;
    const url = this.apiUrl(source, "/repository/tree", { ref: revision, recursive: "true", per_page: "100", pagination: "keyset" });
    let tree: readonly GitLabTreeItem[];
    try { tree = await this.requestPaged<GitLabTreeItem>(source, url); }
    catch (error) {
      if (error instanceof GitLabRequestError && error.status === 404) tree = [];
      else throw error;
    }
    this.treeCache.set(key, tree);
    return tree;
  }

  private async getTextFromTree(source: GitLabRepositoryConfig, tree: readonly GitLabTreeItem[], path: string): Promise<string> {
    const normalized = stripSlash(path);
    const item = tree.find((candidate) => isBlob(candidate) && candidate.path === normalized);
    if (!item?.id) throw new GitLabRequestError(404, "Not Found", "", `source=${source.id}, path=${normalized}`);
    return this.decoder.decode(await this.getBlobBytes(source, item.id));
  }

  private async getBlobBytes(source: GitLabRepositoryConfig, sha: string): Promise<Uint8Array> {
    const blob = await this.requestJson<GitLabBlob>(source, this.apiUrl(source, `/repository/blobs/${encodeURIComponent(sha)}`, {}));
    if (blob.encoding !== "base64" || typeof blob.content !== "string" || (blob.sha && blob.sha.toLowerCase() !== sha.toLowerCase())) throw new Error(`GitLab blob ${sha} did not return valid base64 content.`);
    return new Uint8Array(Buffer.from(blob.content.replace(/\s+/g, ""), "base64"));
  }

  private async requestPaged<T>(source: GitLabRepositoryConfig, firstUrl: string): Promise<readonly T[]> {
    const values: T[] = [];
    let next: string | undefined = firstUrl;
    for (let page = 0; next && page < 1000; page += 1) {
      const response = await requestWithCredentials({ source, url: next, credentials: this.credentials, log: this.log });
      if (!response.ok) throw new GitLabRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest(next));
      const pageValues = await response.json() as unknown;
      if (!Array.isArray(pageValues)) throw new Error(`GitLab returned a malformed paginated response (${describeRequest(next)}).`);
      values.push(...pageValues as T[]);
      next = validatedNextLink(response.headers.get("link"), source);
    }
    if (next) throw new Error(`GitLab pagination exceeded the safe page limit for source '${source.id}'.`);
    return values;
  }

  private async requestJson<T>(source: GitLabRepositoryConfig, url: string): Promise<T> {
    const response = await requestWithCredentials({ source, url, credentials: this.credentials, log: this.log });
    if (!response.ok) throw new GitLabRequestError(response.status, response.statusText, await safeReadErrorBody(response), describeRequest(url));
    return await response.json() as T;
  }

  private apiUrl(source: GitLabRepositoryConfig, route: string, params: Readonly<Record<string, string>>): string {
    const project = encodeURIComponent(`${source.namespace}/${source.repository}`);
    const url = new URL(`https://${source.host}/api/v4/projects/${project}${route}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }

  private sources(): readonly GitLabRepositoryConfig[] { return repositorySources(this.config).filter((source): source is GitLabRepositoryConfig => source.provider === "gitlab"); }
  private sourceForPackage(source: PackageSource): GitLabRepositoryConfig {
    if (source.provider !== "gitlab") throw new Error(`Package source '${source.id}' is not a GitLab source.`);
    return configuredSource(this.config, source) as GitLabRepositoryConfig;
  }
}

export class GitLabRequestError extends Error {
  public constructor(public readonly status: number, statusText: string, public readonly body: string, request: string) {
    super(`GitLab request failed: ${status} ${statusText}${body ? ` - ${body}` : ""} (${request})`); this.name = "GitLabRequestError";
  }
}

function validatedNextLink(header: string | null, source: GitLabRepositoryConfig): string | undefined {
  if (!header) return undefined;
  const entry = header.split(",").map((part) => part.trim()).find((part) => /;\s*rel="?next"?$/i.test(part));
  const raw = entry?.match(/^<([^>]+)>/)?.[1];
  if (!raw) return undefined;
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.host.toLowerCase() !== source.host.toLowerCase() || !url.pathname.startsWith("/api/v4/projects/")) throw new Error(`GitLab returned an unsafe pagination URL for source '${source.id}'.`);
  return url.toString();
}

function isBlob(item: GitLabTreeItem): boolean { return item.type === "blob"; }
function isWithin(path: string | undefined, folder: string): boolean { return typeof path === "string" && (path === folder || path.startsWith(`${folder}/`)); }
function stripSlash(value: string): string { return value.replace(/^\/+/, ""); }
function packageRelativePaths(items: readonly GitLabTreeItem[], sourcePath: string): ReadonlySet<string> { const prefix = `${stripSlash(sourcePath)}/`; return new Set(items.flatMap((item) => isBlob(item) && item.path?.startsWith(prefix) ? [item.path.slice(prefix.length)] : [])); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function comparePackages(left: MarketplacePackage, right: MarketplacePackage): number { return `${left.source.label}:${left.manifest.name}`.localeCompare(`${right.source.label}:${right.manifest.name}`); }
