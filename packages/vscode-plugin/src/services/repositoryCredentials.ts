import type { CredentialProvider, RepositoryCredential, RepositoryProvider, RepositoryConfig } from "@ai-marketplace/core";

export interface SecretStorageLike {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
}

const legacyGitHubKey = "githubToken";
const legacyAzureDevOpsPatKey = "azureDevOpsPat";

export function repositoryCredentialSecretKey(provider: RepositoryProvider, sourceId?: string): string {
  return `repositoryCredential.${provider}.${sourceId ? `source.${sourceId}` : "shared"}`;
}

export function encodeRepositoryCredential(credential: RepositoryCredential): string {
  return JSON.stringify({ kind: credential.kind, token: credential.token });
}

export function decodeRepositoryCredential(value: string | undefined): RepositoryCredential | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as { readonly kind?: unknown; readonly token?: unknown };
    if ((parsed.kind === "bearer" || parsed.kind === "basic-pat" || parsed.kind === "private-token") && typeof parsed.token === "string" && parsed.token.trim()) {
      return { kind: parsed.kind, token: parsed.token.trim() };
    }
  } catch { /* Legacy values are handled by their dedicated keys. */ }
  return undefined;
}

export function createVscodeCredentialProvider(secrets: SecretStorageLike): CredentialProvider {
  return {
    sharedCredentials: async (provider) => {
      const credential = decodeRepositoryCredential(await secrets.get(repositoryCredentialSecretKey(provider)));
      const credentials: RepositoryCredential[] = credential ? [credential] : [];
      if (provider === "github") {
        const legacy = await secrets.get(legacyGitHubKey);
        if (legacy) credentials.push({ kind: "bearer", token: legacy });
      } else if (provider === "azure-devops") {
        const legacy = await secrets.get(legacyAzureDevOpsPatKey);
        if (legacy) credentials.push({ kind: "basic-pat", token: legacy });
      }
      return dedupeCredentials(credentials);
    },
    sourceCredentials: async (source) => {
      const credential = decodeRepositoryCredential(await secrets.get(repositoryCredentialSecretKey(source.provider, source.id)));
      const credentials: RepositoryCredential[] = credential ? [credential] : [];
      if (source.provider === "github") {
        const legacy = await secrets.get(`${legacyGitHubKey}.${source.id}`);
        if (legacy) credentials.push({ kind: "bearer", token: legacy });
      } else if (source.provider === "azure-devops") {
        const legacy = await secrets.get(`${legacyAzureDevOpsPatKey}.${source.id}`);
        if (legacy) credentials.push({ kind: "basic-pat", token: legacy });
      }
      return dedupeCredentials(credentials);
    }
  };
}

function dedupeCredentials(credentials: readonly RepositoryCredential[]): readonly RepositoryCredential[] {
  const seen = new Set<string>();
  return credentials.filter((credential) => {
    const key = `${credential.kind}:${credential.token}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function sharedGitHubToken(secrets: SecretStorageLike): Promise<string | undefined> {
  return (await createVscodeCredentialProvider(secrets).sharedCredentials("github"))[0]?.token;
}

export async function storeRepositoryCredential(
  secrets: SecretStorageLike,
  provider: RepositoryProvider,
  credential: RepositoryCredential,
  source?: Pick<RepositoryConfig, "id">
): Promise<void> {
  await secrets.store(repositoryCredentialSecretKey(provider, source?.id), encodeRepositoryCredential(credential));
}
