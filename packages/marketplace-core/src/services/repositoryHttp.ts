import type { CredentialProvider, RepositoryCredential } from "../ports";
import type { MarketplaceConfig, PackageSource, RepositoryConfig, RepositoryProvider } from "../types/packages";
import { packageSourceFromConfig, sourceMatchesConfig } from "./repositoryUrl";

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
const retryDelaysMs = [250, 750, 1500] as const;

export async function requestWithCredentials(options: {
  readonly source: RepositoryConfig;
  readonly url: string;
  readonly accept?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly credentials: CredentialProvider;
  readonly log: (message: string) => void;
}): Promise<Response> {
  const shared = await options.credentials.sharedCredentials(options.source.provider);
  let response = await attemptCredentials(options, shared.length > 0 ? shared : [undefined]);
  if (!isAuthenticationFailureResponse(response, options.source.provider)) return response;

  const sourceCredentials = await options.credentials.sourceCredentials(options.source);
  const prior = new Set(shared.map(credentialKey));
  const unique = sourceCredentials.filter((credential) => !prior.has(credentialKey(credential)));
  if (unique.length === 0) return response;
  options.log(`Retrying ${providerLabel(options.source.provider)} request with a repository-specific credential for source '${options.source.id}'.`);
  response = await attemptCredentials(options, unique);
  return response;
}

async function attemptCredentials(
  options: Parameters<typeof requestWithCredentials>[0],
  credentials: readonly (RepositoryCredential | undefined)[]
): Promise<Response> {
  let response = await fetchWithRetry(options, credentials[0]);
  for (const credential of credentials.slice(1)) {
    if (!isAuthenticationFailureResponse(response, options.source.provider)) break;
    options.log(`Retrying ${providerLabel(options.source.provider)} request with an alternate credential for source '${options.source.id}'.`);
    response = await fetchWithRetry(options, credential);
  }
  return response;
}

async function fetchWithRetry(
  options: Parameters<typeof requestWithCredentials>[0],
  credential: RepositoryCredential | undefined
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const response = await fetch(options.url, { headers: { ...options.headers, ...credentialHeaders(credential, options.accept) } });
      if (!retryableStatuses.has(response.status) || attempt === retryDelaysMs.length) return response;
      options.log(`${providerLabel(options.source.provider)} returned ${response.status} ${response.statusText}; retrying ${describeRequest(options.url)}.`);
    } catch (error) {
      lastError = error;
      if (attempt === retryDelaysMs.length) throw error;
      options.log(`${providerLabel(options.source.provider)} request failed transiently; retrying ${describeRequest(options.url)}.`);
    }
    await delay(retryDelaysMs[attempt]);
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function credentialHeaders(credential: RepositoryCredential | undefined, accept = "application/json"): HeadersInit {
  const headers: Record<string, string> = { Accept: accept };
  if (!credential) return headers;
  switch (credential.kind) {
    case "bearer": headers.Authorization = `Bearer ${credential.token}`; break;
    case "basic-pat": headers.Authorization = `Basic ${Buffer.from(`:${credential.token}`, "utf8").toString("base64")}`; break;
    case "private-token": headers["PRIVATE-TOKEN"] = credential.token; break;
  }
  return headers;
}

export function isAuthenticationFailureResponse(response: Response, provider: RepositoryProvider): boolean {
  if (response.status === 401 || response.status === 403) return true;
  if (provider !== "azure-devops") return false;
  return response.status === 203 || Boolean(response.headers.get("content-type")?.toLowerCase().includes("text/html"));
}

export function repositorySources(config: MarketplaceConfig): readonly RepositoryConfig[] {
  return (config.repositories ?? [{
    id: "default",
    label: "Default repository",
    provider: "github" as const,
    host: "github.com" as const,
    owner: config.repository.split("/")[0] ?? "",
    repository: config.repository.split("/")[1] ?? config.repository,
    branch: config.branch,
    enabled: true,
    allowDefaultPackages: true,
    packageFolders: config.packageFolders
  }]).filter((source) => source.enabled);
}

export function configuredSource(config: MarketplaceConfig, source: PackageSource): RepositoryConfig {
  const candidate = repositorySources(config).find((item) => item.id === source.id);
  if (!candidate) throw new Error(`Package source '${source.id}' is no longer configured.`);
  if (!sourceMatchesConfig(source, candidate)) throw new Error(`Package source '${source.id}' no longer matches the loaded catalog.`);
  return candidate;
}

export function packageSource(source: RepositoryConfig): PackageSource {
  return packageSourceFromConfig(source);
}

export function isFullGitRevision(value: string): boolean {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
}

export async function safeReadErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "";
    try {
      const json = JSON.parse(text) as { readonly message?: unknown; readonly error?: unknown };
      const candidate = typeof json.message === "string" ? json.message : typeof json.error === "string" ? json.error : text;
      return summarizeErrorBody(candidate);
    } catch { return summarizeErrorBody(text); }
  } catch { return ""; }
}

export function describeRequest(rawUrl: string): string {
  const url = new URL(rawUrl);
  return `host=${url.host}, route=${url.pathname}`;
}

function credentialKey(credential: RepositoryCredential): string { return `${credential.kind}:${credential.token}`; }
function providerLabel(provider: RepositoryProvider): string { return provider === "github" ? "GitHub" : provider === "azure-devops" ? "Azure DevOps" : "GitLab"; }
function summarizeErrorBody(text: string): string { return text.replace(/\s+/g, " ").trim().slice(0, 600); }
async function delay(milliseconds: number): Promise<void> { await new Promise((resolve) => setTimeout(resolve, milliseconds)); }
