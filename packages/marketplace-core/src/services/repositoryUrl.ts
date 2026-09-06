import type {
  AzureDevOpsRepositoryConfig,
  GitHubRepositoryConfig,
  GitLabRepositoryConfig,
  PackageSource,
  PackageType,
  RepositoryConfig,
  RepositoryProvider
} from "../types/packages";

export interface RepositoryUrlParts {
  readonly provider: RepositoryProvider;
  readonly host: string;
  readonly repository: string;
  readonly owner?: string;
  readonly organization?: string;
  readonly project?: string;
  readonly namespace?: string;
}

const safeSegment = /^[A-Za-z0-9_.-]+$/;

export function parseRepositoryUrl(value: string, explicitProvider?: RepositoryProvider): RepositoryUrlParts | undefined {
  const github = parseGitHub(value);
  const azure = parseAzureDevOps(value);
  const gitlab = parseGitLab(value, explicitProvider === "gitlab");
  const parsed = github ?? azure ?? gitlab;
  if (!parsed || (explicitProvider !== undefined && parsed.provider !== explicitProvider)) return undefined;
  return parsed;
}

export function parseGitHub(value: string): RepositoryUrlParts | undefined {
  const trimmed = value.trim().replace(/\.git$/i, "");
  if (!trimmed) return undefined;
  const direct = trimmed.split("/");
  if (direct.length === 2 && direct.every((part) => safeSegment.test(part))) {
    return { provider: "github", host: "github.com", owner: direct[0], repository: direct[1] };
  }
  if (/^https:\/\/github\.com:/i.test(trimmed)) return undefined;
  const parsed = safeUrl(trimmed);
  if (!parsed || parsed.hostname.toLowerCase() !== "github.com" || parsed.port !== "") return undefined;
  const segments = decodedSegments(parsed);
  if (!segments || segments.length !== 2 || !segments.every((part) => safeSegment.test(part))) return undefined;
  return { provider: "github", host: "github.com", owner: segments[0], repository: segments[1].replace(/\.git$/i, "") };
}

export function parseAzureDevOps(value: string): RepositoryUrlParts | undefined {
  const trimmed = value.trim();
  if (/^https:\/\/dev\.azure\.com:/i.test(trimmed)) return undefined;
  const parsed = safeUrl(trimmed);
  if (!parsed || parsed.hostname.toLowerCase() !== "dev.azure.com" || parsed.port !== "") return undefined;
  const segments = decodedSegments(parsed);
  if (!segments || segments.length !== 4 || segments[2].toLowerCase() !== "_git") return undefined;
  if (![segments[0], segments[1], segments[3]].every(isSafeDecodedSegment)) return undefined;
  return { provider: "azure-devops", host: "dev.azure.com", organization: segments[0], project: segments[1], repository: segments[3].replace(/\.git$/i, "") };
}

export function parseGitLab(value: string, allowSelfManaged = false): RepositoryUrlParts | undefined {
  const parsed = safeUrl(value.trim());
  if (!parsed) return undefined;
  const host = parsed.host.toLowerCase();
  if (!allowSelfManaged && parsed.hostname.toLowerCase() !== "gitlab.com") return undefined;
  const segments = decodedSegments(parsed);
  if (!segments || segments.length < 2 || segments.includes("-") || !segments.every(isSafeDecodedSegment)) return undefined;
  const repository = segments.at(-1)!.replace(/\.git$/i, "");
  const namespace = segments.slice(0, -1).join("/");
  if (!isSafeDecodedSegment(repository) || namespace.length === 0) return undefined;
  return { provider: "gitlab", host, namespace, repository };
}

export function toRepositoryConfig(
  parts: RepositoryUrlParts,
  common: Omit<RepositoryConfig, "provider" | "host" | "owner" | "organization" | "project" | "namespace" | "repository">
): RepositoryConfig {
  if (parts.provider === "github") return { ...common, provider: "github", host: "github.com", owner: parts.owner!, repository: parts.repository } as GitHubRepositoryConfig;
  if (parts.provider === "azure-devops") return { ...common, provider: "azure-devops", host: "dev.azure.com", organization: parts.organization!, project: parts.project!, repository: parts.repository } as AzureDevOpsRepositoryConfig;
  return { ...common, provider: "gitlab", host: parts.host, namespace: parts.namespace!, repository: parts.repository } as GitLabRepositoryConfig;
}

export function repositoryIdentity(source: RepositoryConfig | PackageSource): string {
  switch (source.provider) {
    case "github": return `${source.owner}/${source.repository}`;
    case "azure-devops": return `${source.organization}/${source.project}/${source.repository}`;
    case "gitlab": return `${source.namespace}/${source.repository}`;
  }
}

export function repositoryUrl(source: RepositoryConfig | PackageSource): string {
  switch (source.provider) {
    case "github": return `https://github.com/${source.owner}/${source.repository}`;
    case "azure-devops": return `https://dev.azure.com/${source.organization}/${source.project}/_git/${source.repository}`;
    case "gitlab": return `https://${source.host}/${source.namespace}/${source.repository}`;
  }
}

export function packageSourceFromConfig(source: RepositoryConfig): PackageSource {
  const common = { id: source.id, label: source.label, repository: source.repository, branch: source.branch };
  switch (source.provider) {
    case "github": return { ...common, provider: "github", host: "github.com", owner: source.owner };
    case "azure-devops": return { ...common, provider: "azure-devops", host: "dev.azure.com", organization: source.organization, project: source.project };
    case "gitlab": return { ...common, provider: "gitlab", host: source.host, namespace: source.namespace };
  }
}

export function sourceMatchesConfig(source: PackageSource, configured: RepositoryConfig): boolean {
  return source.provider === configured.provider
    && source.id === configured.id
    && source.branch === configured.branch
    && repositoryIdentity(source) === repositoryIdentity(configured)
    && source.host === configured.host;
}

export function normalizedSourceCredentialId(id: string): string {
  return id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function safeUrl(value: string): URL | undefined {
  let parsed: URL;
  try { parsed = new URL(value); } catch { return undefined; }
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "" || parsed.search !== "" || parsed.hash !== "") return undefined;
  return parsed;
}

function decodedSegments(parsed: URL): string[] | undefined {
  try { return parsed.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment)); } catch { return undefined; }
}

function isSafeDecodedSegment(value: string): boolean {
  return value.length > 0 && value !== "." && value !== ".." && !/[\\/\0]/.test(value);
}

export type PackageFolders = Readonly<Record<PackageType, string>>;
