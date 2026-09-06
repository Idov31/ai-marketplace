import type { CredentialProvider, RepositoryCredential, RepositoryConfig, RepositoryProvider } from "@ai-marketplace/core";
import { normalizedSourceCredentialId } from "@ai-marketplace/core";

export function createEnvironmentCredentialProvider(env: NodeJS.ProcessEnv): CredentialProvider {
  return {
    sharedCredentials: async (provider) => sharedCredentials(env, provider),
    sourceCredentials: async (source) => sourceCredentials(env, source)
  };
}

export function sharedCredentials(env: NodeJS.ProcessEnv, provider: RepositoryProvider): readonly RepositoryCredential[] {
  switch (provider) {
    case "github": return compact([
      credential("bearer", env.GH_TOKEN, "GH_TOKEN"),
      credential("bearer", env.GITHUB_TOKEN, "GITHUB_TOKEN")
    ]);
    case "azure-devops": return compact([
      credential("bearer", env.AZURE_DEVOPS_ACCESS_TOKEN, "AZURE_DEVOPS_ACCESS_TOKEN"),
      credential("basic-pat", env.AZURE_DEVOPS_EXT_PAT, "AZURE_DEVOPS_EXT_PAT")
    ]);
    case "gitlab": return compact([
      credential("bearer", env.GITLAB_OAUTH_TOKEN, "GITLAB_OAUTH_TOKEN"),
      credential("private-token", env.GITLAB_TOKEN, "GITLAB_TOKEN")
    ]);
  }
}

export function sourceCredentials(env: NodeJS.ProcessEnv, source: RepositoryConfig): readonly RepositoryCredential[] {
  const suffix = normalizedSourceCredentialId(source.id);
  switch (source.provider) {
    case "github": return compact([credential("bearer", env[`AI_MARKETPLACE_GITHUB_TOKEN_${suffix}`], `AI_MARKETPLACE_GITHUB_TOKEN_${suffix}`)]);
    case "azure-devops": return compact([
      credential("bearer", env[`AI_MARKETPLACE_AZURE_DEVOPS_ACCESS_TOKEN_${suffix}`], `AI_MARKETPLACE_AZURE_DEVOPS_ACCESS_TOKEN_${suffix}`),
      credential("basic-pat", env[`AI_MARKETPLACE_AZURE_DEVOPS_PAT_${suffix}`], `AI_MARKETPLACE_AZURE_DEVOPS_PAT_${suffix}`)
    ]);
    case "gitlab": return compact([
      credential("bearer", env[`AI_MARKETPLACE_GITLAB_OAUTH_TOKEN_${suffix}`], `AI_MARKETPLACE_GITLAB_OAUTH_TOKEN_${suffix}`),
      credential("private-token", env[`AI_MARKETPLACE_GITLAB_TOKEN_${suffix}`], `AI_MARKETPLACE_GITLAB_TOKEN_${suffix}`)
    ]);
  }
}

export function credentialSourceSummary(env: NodeJS.ProcessEnv, sources: readonly RepositoryConfig[]): string {
  const names = new Set<string>();
  const providers: readonly RepositoryProvider[] = sources.length > 0 ? [...new Set(sources.map((source) => source.provider))] : ["github"];
  for (const provider of providers) {
    const item = sharedCredentials(env, provider)[0];
    if (item?.source) names.add(item.source);
  }
  for (const source of sources) {
    const item = sourceCredentials(env, source)[0];
    if (item?.source) names.add(item.source);
  }
  return names.size > 0 ? [...names].sort().join(",") : "none";
}

export function activeCredentialValues(env: NodeJS.ProcessEnv): readonly string[] {
  return Object.entries(env).filter(([key, value]) => isRepositoryCredentialEnvironmentKey(key) && Boolean(value)).map(([, value]) => value!);
}

export function redactCredentials(value: string, env: NodeJS.ProcessEnv): string {
  let redacted = value;
  for (const token of activeCredentialValues(env)) redacted = redacted.split(token).join("[REDACTED]");
  return redacted
    .replace(/(?:ghp|github_pat|glpat|azdopat)_[A-Za-z0-9_-]+/gi, "[REDACTED]")
    .replace(/(authorization:\s*(?:basic|bearer)\s+)[A-Za-z0-9._~+/=-]+/ig, "$1[REDACTED]")
    .replace(/(private-token:\s*)\S+/ig, "$1[REDACTED]");
}

export function isRepositoryCredentialEnvironmentKey(key: string): boolean {
  return /^(?:GH_TOKEN|GITHUB_TOKEN|AZURE_DEVOPS_ACCESS_TOKEN|AZURE_DEVOPS_EXT_PAT|GITLAB_OAUTH_TOKEN|GITLAB_TOKEN|AI_MARKETPLACE_(?:GITHUB_TOKEN|AZURE_DEVOPS_(?:ACCESS_TOKEN|PAT)|GITLAB_(?:OAUTH_TOKEN|TOKEN))_[A-Z0-9_]+)$/i.test(key);
}

function credential(kind: RepositoryCredential["kind"], token: string | undefined, source: string): RepositoryCredential | undefined {
  return token ? { kind, token, source } : undefined;
}
function compact(values: readonly (RepositoryCredential | undefined)[]): readonly RepositoryCredential[] {
  const seen = new Set<string>();
  return values.filter((item): item is RepositoryCredential => Boolean(item)).filter((item) => { const key = `${item.kind}:${item.token}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
