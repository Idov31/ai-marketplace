import type * as vscode from "vscode";
import { packageTypes, repositoryProviders, type PackageType, type MarketplaceConfig, type Platform, type PlatformPathOverrides, type RepositoryConfig, type RepositoryProvider } from "../types/packages";
import { normalizeDefaultPlatform } from "./configurationValues";
import { normalizeGroupList, parseRepositoryUrl, repositoryIdentity, toRepositoryConfig } from "@ai-marketplace/core";
import { ValidationError, isPackageType } from "./validation";

const defaultPackageFolders: Readonly<Record<PackageType, string>> = {
  skill: "Skills/",
  command: "Commands/",
  mcp: "Mcps/",
  agent: "Agents/",
  hook: "Hooks/",
  rule: "Rules/"
};

export interface EditableRepositorySetting {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly provider: RepositoryProvider | "";
  readonly branch: string;
  readonly enabled: boolean;
  readonly allowDefaultPackages: boolean;
  readonly packageFolders: Readonly<Record<PackageType, string>>;
}

export interface UserAutomationPreferences {
  readonly autoUpdateEnabled: boolean;
  readonly autoInstallGroups: readonly string[];
}

export interface UserMarketplaceDefaults {
  readonly branch: string;
  readonly platform: Platform;
}

export function readMarketplaceConfig(config = getVscode().workspace.getConfiguration("aiMarketplace")): MarketplaceConfig {
  const automation = readUserAutomationPreferences(config);
  const packageFolders = normalizePackageFolders(config.get<Record<string, unknown>>("packageFolders"));
  const repositoriesValue = explicitRepositorySetting(config);
  const repositorySetting = config.get<string>("repository")?.trim();
  const parsedRepo = repositorySetting ? parseRepositoryUrl(repositorySetting) : undefined;
  if (repositorySetting && !parsedRepo && repositoriesValue === undefined) {
    throw new ValidationError("aiMarketplace.repository must be a supported GitHub, Azure DevOps, or GitLab.com repository value.");
  }
  const legacy = parsedRepo ? legacyRepositoryConfig(parsedRepo, normalizeDefaultBranch(config.get<string>("branch")), packageFolders) : undefined;
  const repositories = repositoriesValue === undefined ? (legacy ? [legacy] : []) : normalizeRepositories(repositoriesValue, packageFolders);
  const primary = repositories[0];

  return {
    repository: primary ? repositoryIdentity(primary) : "",
    branch: primary?.branch ?? normalizeDefaultBranch(config.get<string>("branch")),
    packageFolders: primary?.packageFolders ?? packageFolders,
    repositories,
    platformPathOverrides: config.get<PlatformPathOverrides>("platformPathOverrides") ?? {},
    defaultPlatform: normalizeDefaultPlatform(config.get<string>("defaultPlatform")),
    ...automation
  };
}

export function readUserAutomationPreferences(config = getVscode().workspace.getConfiguration("aiMarketplace")): UserAutomationPreferences {
  return {
    autoUpdateEnabled: config.get<boolean>("autoUpdate") === true,
    autoInstallGroups: normalizeAutoInstallGroups(config.get<unknown>("autoInstallGroups"))
  };
}

export function readUserMarketplaceDefaults(config = getVscode().workspace.getConfiguration("aiMarketplace")): UserMarketplaceDefaults {
  return {
    branch: normalizeDefaultBranch(config.get<string>("branch")),
    platform: normalizeDefaultPlatform(config.get<string>("defaultPlatform"))
  };
}

export function readEditableRepositorySettings(): readonly EditableRepositorySetting[] {
  return (readMarketplaceConfig().repositories ?? []).map(toEditableRepositorySetting);
}

export async function writeUserRepositorySettings(value: unknown): Promise<readonly EditableRepositorySetting[]> {
  const config = getVscode().workspace.getConfiguration("aiMarketplace");
  const packageFolders = normalizePackageFolders(config.get<Record<string, unknown>>("packageFolders"));
  const normalized = normalizeRepositories(value, packageFolders);
  const editable = normalized.map(toEditableRepositorySetting);
  await config.update("repositories", editable.map(toPersistedRepositorySetting), getVscode().ConfigurationTarget.Global);
  const inspection = config.inspect<unknown>("repositories");
  for (const target of repositoryOverrideTargets(inspection)) {
    await config.update("repositories", undefined, target === "workspaceFolder"
      ? getVscode().ConfigurationTarget.WorkspaceFolder
      : getVscode().ConfigurationTarget.Workspace);
  }
  return editable;
}

export async function writeUserAutoUpdate(enabled: boolean): Promise<void> {
  await getVscode().workspace.getConfiguration("aiMarketplace").update("autoUpdate", enabled, getVscode().ConfigurationTarget.Global);
}

export async function writeUserAutoInstallGroups(groups: readonly string[]): Promise<void> {
  await getVscode().workspace.getConfiguration("aiMarketplace").update("autoInstallGroups", normalizeGroupList(groups), getVscode().ConfigurationTarget.Global);
}

export async function writeUserMarketplaceDefaults(defaults: UserMarketplaceDefaults): Promise<void> {
  const config = getVscode().workspace.getConfiguration("aiMarketplace");
  await config.update("branch", normalizeDefaultBranch(defaults.branch), getVscode().ConfigurationTarget.Global);
  await config.update("defaultPlatform", normalizeDefaultPlatform(defaults.platform), getVscode().ConfigurationTarget.Global);
}

export function normalizeDefaultBranch(value: string | undefined): string {
  const branch = value?.trim() || "main";
  if (!/^[a-zA-Z0-9._/@-]+$/.test(branch) || branch.includes("..") || branch.includes("@{") || branch.startsWith("/")) {
    throw new ValidationError("Default repository branch must be a safe branch name.");
  }
  return branch;
}

export function normalizeAutoInstallGroups(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? normalizeGroupList(value) : [];
}

export function tryReadMarketplaceConfig(): MarketplaceConfig | undefined {
  try {
    return readMarketplaceConfig();
  } catch {
    return undefined;
  }
}

export function normalizePackageFolders(value: Record<string, unknown> | undefined): Readonly<Record<PackageType, string>> {
  const normalized: Partial<Record<PackageType, string>> = { ...defaultPackageFolders };
  if (!value) {
    return normalized as Readonly<Record<PackageType, string>>;
  }

  for (const [key, folderValue] of Object.entries(value)) {
    if (!isPackageType(key)) {
      continue;
    }
    if (typeof folderValue !== "string" || folderValue.trim().length === 0) {
      throw new ValidationError(`Package folder for '${key}' must be a non-empty string.`);
    }
    const normalizedFolder = folderValue.trim().replaceAll("\\", "/");
    if (normalizedFolder.startsWith("/") || /^[a-zA-Z]:\//.test(normalizedFolder)
      || normalizedFolder.split("/").some((segment) => segment === "." || segment === "..")) {
      throw new ValidationError(`Package folder for '${key}' must be a safe relative path.`);
    }
    normalized[key] = ensureTrailingSlash(normalizedFolder);
  }

  for (const packageType of packageTypes) {
    normalized[packageType] ??= defaultPackageFolders[packageType];
  }

  return normalized as Readonly<Record<PackageType, string>>;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function normalizeRepositories(
  value: unknown,
  defaultFolders: Readonly<Record<PackageType, string>>
): readonly RepositoryConfig[] {
  if (!Array.isArray(value)) {
    throw new ValidationError("Setting aiMarketplace.repositories must be an array when provided.");
  }
  const seen = new Set<string>();
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new ValidationError(`Repository entry ${index + 1} must be an object.`);
    }
    const id = requiredRepositoryString(entry, "id", index);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id)) {
      throw new ValidationError(`Repository entry ${index + 1} has an unsafe id.`);
    }
    if (seen.has(id)) {
      throw new ValidationError(`Repository id '${id}' is duplicated.`);
    }
    seen.add(id);
    const url = requiredRepositoryString(entry, "url", index);
    const provider = optionalProvider(entry.provider, id);
    const parsed = parseRepositoryUrl(url, provider);
    if (!parsed) {
      throw new ValidationError(`Repository entry '${id}' must use a URL matching its supported repository provider.`);
    }
    const folders = entry.packageFolders === undefined
      ? defaultFolders
      : normalizePackageFolders(asRecord(entry.packageFolders, `Repository entry '${id}' packageFolders`));
    const branch = optionalRepositoryString(entry, "branch") ?? "main";
    if (!/^[a-zA-Z0-9._/@-]+$/.test(branch) || branch.includes("..") || branch.includes("@{") || branch.startsWith("/")) {
      throw new ValidationError(`Repository entry '${id}' has an unsafe branch.`);
    }
    return toRepositoryConfig(parsed, {
      id,
      label: optionalRepositoryString(entry, "label") ?? id,
      branch,
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : true,
      allowDefaultPackages: typeof entry.allowDefaultPackages === "boolean" ? entry.allowDefaultPackages : false,
      packageFolders: folders
    });
  });
}

function explicitRepositorySetting(config: vscode.WorkspaceConfiguration): unknown | undefined {
  return selectExplicitRepositorySetting(config.inspect<unknown>("repositories"));
}

export function selectExplicitRepositorySetting(inspected: {
  readonly globalValue?: unknown;
  readonly workspaceValue?: unknown;
  readonly workspaceFolderValue?: unknown;
} | undefined): unknown | undefined {
  return inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
}

export function repositoryOverrideTargets(inspected: {
  readonly workspaceValue?: unknown;
  readonly workspaceFolderValue?: unknown;
} | undefined): readonly ("workspace" | "workspaceFolder")[] {
  return [
    ...(inspected?.workspaceFolderValue === undefined ? [] : ["workspaceFolder" as const]),
    ...(inspected?.workspaceValue === undefined ? [] : ["workspace" as const])
  ];
}

function toEditableRepositorySetting(source: RepositoryConfig): EditableRepositorySetting {
  return {
    id: source.id,
    label: source.label,
    url: repositoryUrl(source),
    provider: source.provider,
    branch: source.branch,
    enabled: source.enabled,
    allowDefaultPackages: source.allowDefaultPackages,
    packageFolders: source.packageFolders
  };
}

function toPersistedRepositorySetting(source: EditableRepositorySetting): Record<string, unknown> {
  return {
    id: source.id,
    label: source.label,
    url: source.url,
    ...(source.provider === "" ? {} : { provider: source.provider }),
    branch: source.branch,
    enabled: source.enabled,
    allowDefaultPackages: source.allowDefaultPackages,
    packageFolders: source.packageFolders
  };
}

function repositoryUrl(source: RepositoryConfig): string {
  switch (source.provider) {
    case "github": return `https://github.com/${source.owner}/${source.repository}`;
    case "azure-devops": return `https://dev.azure.com/${source.organization}/${source.project}/_git/${source.repository}`;
    case "gitlab": return `https://${source.host}/${source.namespace}/${source.repository}`;
  }
}

function legacyRepositoryConfig(
  repo: NonNullable<ReturnType<typeof parseRepositoryUrl>>,
  branch: string,
  packageFolders: Readonly<Record<PackageType, string>>
): RepositoryConfig {
  return toRepositoryConfig(repo, {
    id: "default",
    label: "Default repository",
    branch,
    enabled: true,
    allowDefaultPackages: true,
    packageFolders
  });
}

function optionalProvider(value: unknown, id: string): RepositoryProvider | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !repositoryProviders.includes(value as RepositoryProvider)) {
    throw new ValidationError(`Repository entry '${id}' has an unsupported provider.`);
  }
  return value as RepositoryProvider;
}

function requiredRepositoryString(record: Record<string, unknown>, key: string, index: number): string {
  const value = optionalRepositoryString(record, key);
  if (!value) {
    throw new ValidationError(`Repository entry ${index + 1} must include a non-empty '${key}' string.`);
  }
  return value;
}

function optionalRepositoryString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(value: unknown, description: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ValidationError(`${description} must be an object.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getVscode(): typeof vscode {
  return require("vscode") as typeof vscode;
}
