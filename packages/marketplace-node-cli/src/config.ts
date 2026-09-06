import { resolve } from "node:path";
import {
  defaultGitHubRepositoryUrl,
  packageTypes,
  normalizedSourceCredentialId,
  parseGitHubRepo,
  parseRepositoryUrl,
  repositoryIdentity,
  repositoryProviders,
  toRepositoryConfig,
  type MarketplaceConfig,
  type MarketplaceStorage,
  type PackageType,
  type Platform,
  type RepositoryConfig,
  type RepositoryProvider
} from "@ai-marketplace/core";

export const defaultPackageFolders: Readonly<Record<PackageType, string>> = {
  skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/"
};

export interface MarketplaceCliConfigFile {
  readonly schemaVersion: 1;
  readonly repositories?: readonly MarketplaceCliRepository[];
  readonly packageFolders?: Partial<Record<PackageType, string>>;
  readonly platformPathOverrides?: Readonly<Record<string, string>>;
  readonly autoInstallGroups?: readonly string[];
  readonly autoUpdate?: boolean;
}

export interface MarketplaceCliRepository {
  readonly id: string;
  readonly url: string;
  readonly provider?: RepositoryProvider;
  readonly label?: string;
  readonly branch?: string;
  readonly enabled?: boolean;
  readonly allowDefaultPackages?: boolean;
  readonly packageFolders?: Partial<Record<PackageType, string>>;
}

export interface MarketplaceCliHostPolicy {
  readonly platform: Platform;
  readonly displayName: string;
  readonly configFileName: string;
  readonly mcpConfigRelativePath: string;
  readonly supportedScopes: readonly ("workspace" | "global")[];
}

export function hostConfigRelativePath(policy: MarketplaceCliHostPolicy): string {
  return `.ai_marketplace/${policy.configFileName}`;
}

export function configPath(home: string, policy: MarketplaceCliHostPolicy): string {
  return resolve(home, hostConfigRelativePath(policy));
}

export async function readHostConfig(storage: MarketplaceStorage, policy: MarketplaceCliHostPolicy): Promise<MarketplaceCliConfigFile> {
  const bytes = await storage.readFile("global", hostConfigRelativePath(policy));
  if (bytes === undefined) return { schemaVersion: 1 };
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(bytes).toString("utf8")); } catch (error) { throw new Error(`Unable to parse ${policy.displayName} marketplace configuration: ${message(error)}`); }
  rejectCredentialFields(parsed, policy);
  return normalizeFile(parsed, policy);
}

export async function writeHostConfig(storage: MarketplaceStorage, policy: MarketplaceCliHostPolicy, config: MarketplaceCliConfigFile): Promise<void> {
  await storage.writeFileAtomic("global", hostConfigRelativePath(policy), Buffer.from(`${JSON.stringify(normalizeFile(config, policy), null, 2)}\n`, "utf8"));
}

export function toMarketplaceConfig(raw: MarketplaceCliConfigFile, policy: MarketplaceCliHostPolicy): MarketplaceConfig {
  const packageFolders = normalizedFolders(raw.packageFolders);
  const sources = raw.repositories?.map((source) => normalizeSource(source, packageFolders));
  assertCredentialIdCollisions(sources ?? []);
  const legacy = parseGitHubRepo(defaultGitHubRepositoryUrl)!;
  return {
    repository: legacy.fullName,
    branch: "main",
    packageFolders,
    ...(sources && sources.length > 0 ? { repositories: sources } : {}),
    platformPathOverrides: { [policy.platform]: normalizedOverrides(raw.platformPathOverrides) },
    defaultPlatform: policy.platform,
    autoUpdateEnabled: raw.autoUpdate === true,
    autoInstallGroups: raw.autoInstallGroups ?? [],
  };
}

function normalizeSource(source: MarketplaceCliRepository, defaults: Readonly<Record<PackageType, string>>): RepositoryConfig {
  if (!source || typeof source.id !== "string" || !/^[A-Za-z0-9._-]+$/.test(source.id)) throw new Error("Repository id must contain only letters, digits, dot, underscore, or hyphen.");
  const parsed = typeof source.url === "string" ? parseRepositoryUrl(source.url, source.provider) : undefined;
  if (!parsed) throw new Error(`Repository '${source.id}' must use a URL matching its supported repository provider.`);
  const branch = source.branch ?? "main";
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes("..")) throw new Error(`Repository '${source.id}' has an invalid branch.`);
  return toRepositoryConfig(parsed, {
    id: source.id,
    label: source.label?.trim() || source.id,
    branch,
    enabled: source.enabled !== false,
    allowDefaultPackages: source.allowDefaultPackages === true,
    packageFolders: normalizedFolders(source.packageFolders, defaults)
  });
}

function normalizedFolders(raw?: Partial<Record<PackageType, string>>, defaults = defaultPackageFolders): Readonly<Record<PackageType, string>> {
  return Object.fromEntries(packageTypes.map((type) => {
    const value = raw?.[type] ?? defaults[type];
    if (typeof value !== "string" || value.trim() === "" || value.startsWith("/") || value.split(/[\\/]/).includes("..")) throw new Error(`Unsafe package folder for '${type}'.`);
    return [type, value];
  })) as unknown as Readonly<Record<PackageType, string>>;
}

function normalizedOverrides(raw?: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  if (!raw) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key, value]) => packageTypes.includes(key as PackageType) && typeof value === "string"));
}

function normalizeFile(value: unknown, policy: MarketplaceCliHostPolicy): MarketplaceCliConfigFile {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error(`${policy.displayName} marketplace configuration must use schemaVersion 1.`);
  assertAllowedKeys(value, ["schemaVersion", "repositories", "packageFolders", "platformPathOverrides", "autoInstallGroups", "autoUpdate"], "config");
  const repositories = value.repositories === undefined ? undefined : normalizeRepositories(value.repositories);
  const packageFolders = value.packageFolders === undefined ? undefined : normalizeStringMap(value.packageFolders, "packageFolders");
  const platformPathOverrides = value.platformPathOverrides === undefined ? undefined : normalizeStringMap(value.platformPathOverrides, "platformPathOverrides");
  if (value.autoInstallGroups !== undefined && (!Array.isArray(value.autoInstallGroups) || !value.autoInstallGroups.every((item) => typeof item === "string"))) throw new Error("autoInstallGroups must be an array of strings.");
  if (value.autoUpdate !== undefined && typeof value.autoUpdate !== "boolean") throw new Error("autoUpdate must be boolean.");
  return {
    schemaVersion: 1,
    ...(repositories === undefined ? {} : { repositories }),
    ...(packageFolders === undefined ? {} : { packageFolders }),
    ...(platformPathOverrides === undefined ? {} : { platformPathOverrides }),
    ...(value.autoInstallGroups === undefined ? {} : { autoInstallGroups: value.autoInstallGroups }),
    ...(value.autoUpdate === undefined ? {} : { autoUpdate: value.autoUpdate })
  };
}

function normalizeRepositories(value: unknown): readonly MarketplaceCliRepository[] {
  if (!Array.isArray(value)) throw new Error("repositories must be an array.");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("Each repository must be an object.");
    assertAllowedKeys(item, ["id", "url", "provider", "label", "branch", "enabled", "allowDefaultPackages", "packageFolders"], "repository");
    if (typeof item.id !== "string" || typeof item.url !== "string") throw new Error("Each repository requires string id and url fields.");
    if (item.provider !== undefined && (typeof item.provider !== "string" || !repositoryProviders.includes(item.provider as RepositoryProvider))) throw new Error("Repository provider is unsupported.");
    if (item.label !== undefined && typeof item.label !== "string") throw new Error("Repository label must be a string.");
    if (item.branch !== undefined && typeof item.branch !== "string") throw new Error("Repository branch must be a string.");
    if (item.enabled !== undefined && typeof item.enabled !== "boolean") throw new Error("Repository enabled must be boolean.");
    if (item.allowDefaultPackages !== undefined && typeof item.allowDefaultPackages !== "boolean") throw new Error("Repository allowDefaultPackages must be boolean.");
    const folders = item.packageFolders === undefined ? undefined : normalizeStringMap(item.packageFolders, "repository packageFolders");
    return { id: item.id, url: item.url, ...(item.provider === undefined ? {} : { provider: item.provider as RepositoryProvider }), ...(item.label === undefined ? {} : { label: item.label }), ...(item.branch === undefined ? {} : { branch: item.branch }), ...(item.enabled === undefined ? {} : { enabled: item.enabled }), ...(item.allowDefaultPackages === undefined ? {} : { allowDefaultPackages: item.allowDefaultPackages }), ...(folders === undefined ? {} : { packageFolders: folders }) };
  });
}

function assertCredentialIdCollisions(sources: readonly RepositoryConfig[]): void {
  const seen = new Map<string, string>();
  for (const source of sources) {
    const normalized = normalizedSourceCredentialId(source.id);
    const previous = seen.get(normalized);
    if (previous) throw new Error(`Repository ids '${previous}' and '${source.id}' collide in credential environment variable names.`);
    seen.set(normalized, source.id);
  }
}

function normalizeStringMap(value: unknown, label: string): Partial<Record<PackageType, string>> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  assertAllowedKeys(value, [...packageTypes], label);
  const output: Partial<Record<PackageType, string>> = {};
  for (const type of packageTypes) {
    const entry = value[type];
    if (entry !== undefined) {
      if (typeof entry !== "string") throw new Error(`${label}.${type} must be a string.`);
      output[type] = entry;
    }
  }
  return output;
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) throw new Error(`${label} contains unknown field '${unexpected}'.`);
}

function rejectCredentialFields(value: unknown, policy: MarketplaceCliHostPolicy, path = "config"): void {
  if (Array.isArray(value)) { value.forEach((item, index) => rejectCredentialFields(item, policy, `${path}[${index}]`)); return; }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (/(?:token|secret|password|credential|authorization|api[-_]?key)/i.test(key)) throw new Error(`${policy.displayName} marketplace configuration must not contain credential field '${path}.${key}'.`);
    rejectCredentialFields(nested, policy, `${path}.${key}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
