import { installScopes, packageTypes, platforms, type InstallScope, type PackageManifest, type PackageMigration, type PackageType, type Platform } from "../types/packages";
import { repoJoin } from "./pathPlanning";
import { canonicalManifestFields, currentManifestReaderSchemaVersion, manifestFieldDisposition, type ManifestDiagnostic, type ValidatedMarketplaceManifest } from "./manifestSchema";
import { isSemanticVersion } from "./versioning";

const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const groupPattern = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/;
const gitRevisionPattern = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;

export class ValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isPackageType(value: string): value is PackageType {
  return packageTypes.includes(value as PackageType);
}

export function isPlatform(value: string): value is Platform {
  return platforms.includes(value as Platform);
}

export function validateMarketplaceManifest(value: unknown, source: string): ValidatedMarketplaceManifest {
  if (!isRecord(value)) {
    throw new ValidationError(`AI Marketplace manifest at ${source} must be an object.`);
  }

  const schemaVersion = readPositiveInteger(value, "schema_version", source);
  const minimumReaderSchemaVersion = readPositiveInteger(value, "minimum_reader_schema_version", source);
  if (minimumReaderSchemaVersion > schemaVersion) throw new ValidationError(`Manifest at ${source} has minimum_reader_schema_version greater than schema_version.`);
  if (minimumReaderSchemaVersion > currentManifestReaderSchemaVersion) {
    throw new ValidationError(`Manifest at ${source} requires reader schema ${minimumReaderSchemaVersion}, but this client supports ${currentManifestReaderSchemaVersion}.`);
  }
  const diagnostics = canonicalDiagnostics(value, schemaVersion, source);
  const pkg = readRecord(value, "package", source);
  const targets = readRecord(value, "targets", source);
  const installation = optionalRecord(value, "installation", source) ?? {};
  const metadata = optionalRecord(value, "metadata", source) ?? {};
  const history = optionalRecord(value, "history", source) ?? {};
  const canonicalPlatforms = readCanonicalStringArray(targets, "platforms", source);
  const canonicalDelivery = readCanonicalStringArray(targets, "delivery", source);
  const tags = metadata["tags"] === undefined ? [] : readCanonicalStringArray(metadata, "tags", source, true);
  const defaultInstall = optionalBoolean(installation, "default", source) ?? false;
  const flat: Record<string, unknown> = {
    name: pkg["name"], type: pkg["type"], version: pkg["version"], description: pkg["description"], group: pkg["group"], entrypoint: pkg["entrypoint"],
    platforms: canonicalPlatforms, delivery: canonicalDelivery, keywords: tags,
    icon: metadata["icon"], "evaluation-score": metadata["evaluation_score"], previous_version: history["previous_revision"], migrations: history["migrations"]
  };
  if (!isSemanticVersion(readString(pkg, "version", source))) throw new ValidationError(`Manifest at ${source} has an invalid SemVer 2.0 package.version.`);
  for (const [path, values] of [["targets.platforms", canonicalPlatforms], ["targets.delivery", canonicalDelivery], ["metadata.tags", tags]] as const) assertUniqueStrings(values, path, source);
  const manifest = { ...validateNormalizedManifest(flat, source), defaultInstall };
  return { manifest, compatibility: { schemaVersion, minimumReaderSchemaVersion }, diagnostics };
}

function validateNormalizedManifest(value: Record<string, unknown>, source: string): PackageManifest {

  const qualifiedName = readString(value, "name", source);
  const id = packageIdFromQualifiedName(qualifiedName, source);
  const group = optionalString(value, "group", source) ?? groupFromQualifiedName(qualifiedName, source);
  const type = readString(value, "type", source);
  const version = readString(value, "version", source);
  const description = readString(value, "description", source);
  const entrypoint = readString(value, "entrypoint", source);
  const manifestPlatforms = readStringArray(value, "platforms", source);
  const manifestDelivery = readStringArray(value, "delivery", source);
  const tags = readStringArray(value, "keywords", source);
  const icon = optionalString(value, "icon", source);
  const previousVersion = optionalString(value, "previous_version", source);
  const migrations = optionalMigrations(value, source, qualifiedName);

  if (!isSafeGroup(group)) {
    throw new ValidationError(`Manifest at ${source} has an unsafe group.`);
  }
  if (!isPackageType(type)) {
    throw new ValidationError(`Manifest at ${source} has unsupported type '${type}'.`);
  }
  if (previousVersion !== undefined && !gitRevisionPattern.test(previousVersion)) {
    throw new ValidationError(`Manifest at ${source} has an invalid 'previous_version'. Expected a full 40 or 64 character hexadecimal Git revision.`);
  }
  if (entrypoint.length === 0 || entrypoint.includes("\\") || entrypoint.startsWith("/") || entrypoint.includes("..")) {
    throw new ValidationError(`Manifest at ${source} has an unsafe entrypoint.`);
  }

  const parsedPlatforms = manifestPlatforms.map((platform) => {
    if (!isPlatform(platform)) {
      throw new ValidationError(`Manifest at ${source} has unsupported platform '${platform}'.`);
    }
    return platform;
  });
  if (parsedPlatforms.length === 0) {
    throw new ValidationError(`Manifest at ${source} must include at least one platform.`);
  }
  if (type === "hook" && parsedPlatforms.some((platform) => platform !== "codex" && platform !== "github-copilot" && platform !== "claude")) {
    throw new ValidationError(`Manifest at ${source} has an unsupported platform for hook packages.`);
  }
  const delivery = parseDelivery(manifestDelivery, type, source);
  if (delivery.includes("cloud") && parsedPlatforms.includes("claude")) {
    throw new ValidationError(`Manifest at ${source} cannot use cloud delivery for the Claude platform.`);
  }
  const evaluationScore = type === "skill" || type === "command"
    ? optionalEvaluationScore(value, source)
    : undefined;

  return {
    id,
    qualifiedName,
    name: qualifiedName,
    group,
    type,
    version,
    description,
    entrypoint,
    platforms: parsedPlatforms,
    delivery,
    tags,
    ...(previousVersion === undefined ? {} : { previousVersion: previousVersion.toLowerCase() }),
    ...(icon === undefined ? {} : { icon }),
    ...(evaluationScore === undefined ? {} : { evaluationScore }),
    ...(migrations === undefined ? {} : { migrations })
  };
}

/** Completes inherited migration fields once repository source identity is known. */
export function validateMigrationSourceIdentity(manifest: PackageManifest, sourceId: string, source: string): void {
  const self = (manifest.migrations ?? []).find((migration) =>
    (migration.from.sourceId ?? sourceId) === sourceId && (migration.from.name ?? manifest.qualifiedName) === manifest.qualifiedName
    && migration.from.repository === undefined);
  if (self) throw new ValidationError(`Manifest at ${source} contains a migration that maps the package to itself.`);
}

function optionalMigrations(record: Record<string, unknown>, source: string, destinationName: string): readonly PackageMigration[] | undefined {
  const value = record["migrations"];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) throw new ValidationError(`Manifest at ${source} has invalid 'migrations'. Expected a non-empty array.`);
  const migrations = value.map((item, index): PackageMigration => {
    if (!isRecord(item) || !isRecord(item["from"])) {
      throw new ValidationError(`Manifest at ${source} migration ${index + 1} must contain only a 'from' mapping.`);
    }
    const from = item["from"];
    const allowed = new Set(["source_id", "name", "repository", "branch", "path"]);
    const unknown = Object.keys(from).find((key) => !allowed.has(key));
    if (unknown) throw new ValidationError(`Manifest at ${source} migration ${index + 1} contains unknown field '${unknown}'.`);
    const sourceId = optionalString(from, "source_id", source);
    const name = optionalString(from, "name", source);
    const repository = optionalString(from, "repository", source);
    const branch = optionalString(from, "branch", source);
    const migrationPath = optionalString(from, "path", source);
    if (sourceId !== undefined && !idPattern.test(sourceId)) throw new ValidationError(`Manifest at ${source} migration ${index + 1} has an unsafe source_id.`);
    if (name !== undefined) packageIdFromQualifiedName(name, source);
    const provenanceCount = [repository, branch, migrationPath].filter((field) => field !== undefined).length;
    if (provenanceCount !== 0 && provenanceCount !== 3) throw new ValidationError(`Manifest at ${source} migration ${index + 1} must provide repository, branch, and path together.`);
    if (branch !== undefined && (branch.includes("..") || branch.includes("\\") || branch.startsWith("/"))) throw new ValidationError(`Manifest at ${source} migration ${index + 1} has an unsafe branch.`);
    if (repository !== undefined && !isSafeRepository(repository)) throw new ValidationError(`Manifest at ${source} migration ${index + 1} has an unsafe repository.`);
    let normalizedPath: string | undefined;
    try { normalizedPath = migrationPath === undefined ? undefined : repoJoin(migrationPath); }
    catch { throw new ValidationError(`Manifest at ${source} migration ${index + 1} has an unsafe path.`); }
    if (sourceId === undefined && name === undefined && repository === undefined) throw new ValidationError(`Manifest at ${source} migration ${index + 1} does not identify a predecessor.`);
    if (sourceId === undefined && name === destinationName && repository === undefined) throw new ValidationError(`Manifest at ${source} migration ${index + 1} maps the package to itself.`);
    return { from: {
      ...(sourceId === undefined ? {} : { sourceId }),
      ...(name === undefined ? {} : { name }),
      ...(repository === undefined ? {} : { repository, branch: branch!, path: normalizedPath! })
    } };
  });
  const keys = migrations.map(({ from }) => JSON.stringify(from));
  if (new Set(keys).size !== keys.length) throw new ValidationError(`Manifest at ${source} contains duplicate migration entries.`);
  return migrations;
}

function isSafeRepository(repository: string): boolean {
  return !repository.includes("\\") && !repository.startsWith("/")
    && repository.split("/").length <= 2
    && repository.split("/").every((segment) => idPattern.test(segment) && segment !== "." && segment !== "..");
}

function parseDelivery(values: readonly string[], type: PackageType, source: string): readonly InstallScope[] {
  const delivery = values.map((value) => {
    if (!installScopes.includes(value as InstallScope)) {
      throw new ValidationError(`Manifest at ${source} has unsupported delivery '${value}'.`);
    }
    return value as InstallScope;
  });
  if (delivery.length === 0) {
    throw new ValidationError(`Manifest at ${source} must include at least one delivery target.`);
  }
  if (type === "mcp" && (delivery.length !== 1 || delivery[0] !== "global")) {
    throw new ValidationError(`Manifest at ${source} must use only global delivery for MCP packages.`);
  }
  if (delivery.includes("cloud") && type !== "agent") {
    throw new ValidationError(`Manifest at ${source} uses cloud delivery, which is currently supported only for agent packages.`);
  }
  return [...new Set(delivery)];
}

function packageIdFromQualifiedName(qualifiedName: string, source: string): string {
  const segments = qualifiedName.split("/");
  const id = segments.at(-1) ?? "";
  if (!idPattern.test(id)) {
    throw new ValidationError(`Manifest at ${source} has an unsafe package name.`);
  }
  if (qualifiedName.includes("\\")
    || segments.some((segment) => segment.trim().length === 0 || segment === "." || segment === "..")
    || (segments.length > 1 && !qualifiedName.startsWith("@"))) {
    throw new ValidationError(`Manifest at ${source} has an invalid scoped package name.`);
  }
  return id;
}

function groupFromQualifiedName(qualifiedName: string, source: string): string {
  const slashIndex = qualifiedName.lastIndexOf("/");
  if (slashIndex <= 1 || !qualifiedName.startsWith("@")) {
    throw new ValidationError(`Manifest at ${source} must include 'group' when its package name is unscoped.`);
  }
  const group = qualifiedName.slice(1, slashIndex);
  if (!isSafeGroup(group)) {
    throw new ValidationError(`Manifest at ${source} has an unsafe group derived from its package name.`);
  }
  return group;
}

function isSafeGroup(group: string): boolean {
  return groupPattern.test(group)
    && !group.includes("\\")
    && group.split("/").every((segment) => segment !== "." && segment !== ".." && segment.length > 0);
}

export function parseHotloadFlag(entrypointContent: string): boolean {
  const normalized = entrypointContent.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/).slice(0, 80);
  const prologueLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" && prologueLines.length === 0) {
      continue;
    }
    if (trimmed === "---" || trimmed === "+++") {
      if (prologueLines.length === 0) {
        prologueLines.push(trimmed);
        continue;
      }
      break;
    }
    if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.includes(":")) {
      prologueLines.push(trimmed.replace(/^[/#*\s]+/, ""));
      continue;
    }
    break;
  }

  return prologueLines.some((line) => /^hotload\s*:\s*true\s*$/i.test(line));
}

function readString(record: Record<string, unknown>, key: string, source: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Manifest at ${source} must include a non-empty '${key}' string.`);
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string, source: string): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`Manifest at ${source} has invalid '${key}'.`);
  }
  return value.trim();
}

function readStringArray(record: Record<string, unknown>, key: string, source: string): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ValidationError(`Manifest at ${source} must include '${key}' as a string array.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function optionalEvaluationScore(record: Record<string, unknown>, source: string): number | undefined {
  const value = record["evaluation-score"];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10) {
    throw new ValidationError(`Manifest at ${source} has invalid 'evaluation-score'. Expected a finite number from 0 to 10.`);
  }
  return value;
}

function canonicalDiagnostics(value: Record<string, unknown>, schemaVersion: number, source: string): readonly ManifestDiagnostic[] {
  const diagnostics: ManifestDiagnostic[] = [];
  visitKnownFields(value, value, "", schemaVersion, source, diagnostics);
  return diagnostics.slice(0, 50);
}

function visitKnownFields(root: Record<string, unknown>, value: Record<string, unknown>, parent: string, schemaVersion: number, source: string, diagnostics: ManifestDiagnostic[]): void {
  for (const [key, child] of Object.entries(value)) {
    const path = parent ? `${parent}.${key}` : key;
    const lifecycle = canonicalManifestFields[path];
    if (!lifecycle) {
      diagnostics.push({ kind: "unknown-field", field: path });
      continue;
    }
    const disposition = manifestFieldDisposition(lifecycle, schemaVersion, lifecycle.replacement !== null && hasManifestPath(root, lifecycle.replacement));
    if (disposition === "reject-not-introduced") throw new ValidationError(`Manifest at ${source} uses '${path}' before schema version ${lifecycle.introducedIn}.`);
    if (disposition === "reject-removed") throw new ValidationError(`Manifest at ${source} uses removed field '${path}'.`);
    if (lifecycle.deprecatedIn !== null && schemaVersion >= lifecycle.deprecatedIn) diagnostics.push({ kind: "deprecated-field", field: path, ...(lifecycle.replacement ? { replacement: lifecycle.replacement } : {}) });
    if (disposition === "prefer-replacement") continue;
    if (isRecord(child)) visitKnownFields(root, child, path, schemaVersion, source, diagnostics);
    else if (Array.isArray(child) && path === "history.migrations") {
      for (const item of child) if (isRecord(item)) visitKnownFields(root, item, `${path}[]`, schemaVersion, source, diagnostics);
    }
  }
}

function hasManifestPath(root: Record<string, unknown>, path: string): boolean {
  let current: unknown = root;
  for (const segment of path.replaceAll("[]", "").split(".")) {
    if (!isRecord(current) || !(segment in current)) return false;
    current = current[segment];
  }
  return true;
}

function readRecord(record: Record<string, unknown>, key: string, source: string): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) throw new ValidationError(`Manifest at ${source} must include '${key}' as a mapping.`);
  return value;
}

function optionalRecord(record: Record<string, unknown>, key: string, source: string): Record<string, unknown> | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new ValidationError(`Manifest at ${source} has invalid '${key}'. Expected a mapping.`);
  return value;
}

function readPositiveInteger(record: Record<string, unknown>, key: string, source: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new ValidationError(`Manifest at ${source} must include '${key}' as a positive integer.`);
  return value;
}

function optionalBoolean(record: Record<string, unknown>, key: string, source: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new ValidationError(`Manifest at ${source} has invalid '${key}'. Expected a boolean.`);
  return value;
}

function readCanonicalStringArray(record: Record<string, unknown>, key: string, source: string, allowEmpty = false): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new ValidationError(`Manifest at ${source} must include '${key}' as ${allowEmpty ? "a" : "a non-empty"} string array without blank entries.`);
  }
  return value.map((item) => (item as string).trim());
}

function assertUniqueStrings(values: readonly unknown[], path: string, source: string): void {
  const normalized = values.filter((value): value is string => typeof value === "string").map((value) => value.trim());
  if (new Set(normalized).size !== normalized.length) throw new ValidationError(`Manifest at ${source} contains duplicate '${path}' entries.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
