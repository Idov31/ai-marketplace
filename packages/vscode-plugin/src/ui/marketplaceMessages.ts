import { packageTypes, repositoryProviders } from "../types/packages";
import type { EditableRepositorySetting } from "../services/configuration";

export function parseEditableRepository(value: unknown): EditableRepositorySetting | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const folders = record.packageFolders;
  if (typeof record.id !== "string" || typeof record.label !== "string" || typeof record.url !== "string"
    || typeof record.branch !== "string" || typeof record.enabled !== "boolean" || typeof record.allowDefaultPackages !== "boolean"
    || typeof record.provider !== "string" || (record.provider !== "" && !repositoryProviders.includes(record.provider as never))
    || typeof folders !== "object" || folders === null || Array.isArray(folders)) return undefined;
  const folderRecord = folders as Record<string, unknown>;
  if (packageTypes.some((type) => typeof folderRecord[type] !== "string")) return undefined;
  return {
    id: record.id,
    label: record.label,
    url: record.url,
    provider: record.provider as EditableRepositorySetting["provider"],
    branch: record.branch,
    enabled: record.enabled,
    allowDefaultPackages: record.allowDefaultPackages,
    packageFolders: Object.fromEntries(packageTypes.map((type) => [type, folderRecord[type] as string])) as unknown as EditableRepositorySetting["packageFolders"]
  };
}
