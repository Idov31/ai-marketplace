import type { PackageManifest } from "../types/packages";

export const canonicalManifestFileName = "ai_marketplace.yaml" as const;
export const currentManifestReaderSchemaVersion = 1 as const;

export interface ManifestFieldLifecycle {
  readonly introducedIn: number;
  readonly deprecatedIn: number | null;
  readonly removedIn: number | null;
  readonly replacement: string | null;
}

export type ManifestFieldDisposition = "accept" | "prefer-replacement" | "reject-not-introduced" | "reject-removed";

export function manifestFieldDisposition(
  lifecycle: ManifestFieldLifecycle,
  schemaVersion: number,
  replacementPresent: boolean
): ManifestFieldDisposition {
  if (schemaVersion < lifecycle.introducedIn) return "reject-not-introduced";
  if (lifecycle.removedIn !== null && schemaVersion >= lifecycle.removedIn) return "reject-removed";
  if (lifecycle.deprecatedIn !== null && schemaVersion >= lifecycle.deprecatedIn && lifecycle.replacement !== null && replacementPresent) {
    return "prefer-replacement";
  }
  return "accept";
}

const activeV1 = { introducedIn: 1, deprecatedIn: null, removedIn: null, replacement: null } as const;

export const canonicalManifestFields: Readonly<Record<string, ManifestFieldLifecycle>> = Object.freeze(Object.fromEntries([
  "schema_version", "minimum_reader_schema_version",
  "package", "package.name", "package.type", "package.version", "package.description", "package.group", "package.entrypoint",
  "targets", "targets.platforms", "targets.delivery",
  "installation", "installation.default",
  "metadata", "metadata.tags", "metadata.icon", "metadata.evaluation_score",
  "history", "history.previous_revision", "history.migrations", "history.migrations[]", "history.migrations[].from",
  "history.migrations[].from.source_id", "history.migrations[].from.name", "history.migrations[].from.repository",
  "history.migrations[].from.branch", "history.migrations[].from.path"
].map((path) => [path, activeV1])));

export type ManifestDiagnosticKind = "unknown-field" | "deprecated-field";
export interface ManifestDiagnostic {
  readonly kind: ManifestDiagnosticKind;
  readonly field: string;
  readonly replacement?: string;
}

export interface ManifestCompatibility {
  readonly schemaVersion: number;
  readonly minimumReaderSchemaVersion: number;
}

export interface ValidatedMarketplaceManifest {
  readonly manifest: PackageManifest;
  readonly compatibility: ManifestCompatibility;
  readonly diagnostics: readonly ManifestDiagnostic[];
}

export function isManifestPath(path: string): boolean {
  const name = path.replace(/\\/g, "/").split("/").at(-1);
  return name === canonicalManifestFileName;
}

export function manifestSourcePath(manifestPath: string): string {
  const normalized = manifestPath.replace(/\\/g, "/");
  if (!isManifestPath(normalized)) throw new Error(`Unsupported AI Marketplace manifest path '${manifestPath}'.`);
  return normalized.slice(0, -canonicalManifestFileName.length).replace(/\/$/, "");
}

export interface ManifestSelection { readonly path: string; readonly sourcePath: string; }

export function selectManifestCandidates(paths: readonly string[]): readonly ManifestSelection[] {
  const folders = new Map<string, string>();
  for (const path of paths) {
    if (!isManifestPath(path)) continue;
    const sourcePath = manifestSourcePath(path);
    folders.set(sourcePath, path);
  }
  return [...folders.entries()].map(([sourcePath, path]) => ({ path, sourcePath }));
}

export function selectManifestInFolder(paths: readonly string[], sourcePath: string): ManifestSelection | undefined {
  return selectManifestCandidates(paths).find((candidate) => candidate.sourcePath === sourcePath.replace(/\/$/, ""));
}

export function isRootManifestFile(relativePath: string): boolean {
  return relativePath === canonicalManifestFileName;
}

export function createMarketplaceManifestJsonSchema(): Readonly<Record<string, unknown>> {
  const property = (path: string, schema: Record<string, unknown>): Record<string, unknown> => ({
    ...schema,
    "x-ai-marketplace-introduced-in": canonicalManifestFields[path].introducedIn,
    "x-ai-marketplace-deprecated-in": canonicalManifestFields[path].deprecatedIn,
    "x-ai-marketplace-removed-in": canonicalManifestFields[path].removedIn,
    "x-ai-marketplace-replacement": canonicalManifestFields[path].replacement
  });
  const string = (path: string, extra: Record<string, unknown> = {}) => property(path, { type: "string", minLength: 1, ...extra });
  const migrationFromProperties = {
    source_id: string("history.migrations[].from.source_id"), name: string("history.migrations[].from.name"),
    repository: string("history.migrations[].from.repository"), branch: string("history.migrations[].from.branch"), path: string("history.migrations[].from.path")
  };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "AI Marketplace package manifest",
    type: "object",
    required: ["schema_version", "minimum_reader_schema_version", "package", "targets"],
    additionalProperties: true,
    properties: {
      schema_version: property("schema_version", { type: "integer", minimum: 1 }),
      minimum_reader_schema_version: property("minimum_reader_schema_version", { type: "integer", minimum: 1 }),
      package: property("package", { type: "object", required: ["name", "type", "version", "description", "entrypoint"], additionalProperties: true, properties: {
        name: string("package.name"), type: string("package.type", { enum: ["skill", "command", "mcp", "agent", "hook", "rule"] }),
        version: string("package.version", { pattern: "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$" }),
        description: string("package.description"), group: string("package.group"), entrypoint: string("package.entrypoint")
      } }),
      targets: property("targets", { type: "object", required: ["platforms", "delivery"], additionalProperties: true, properties: {
        platforms: property("targets.platforms", { type: "array", minItems: 1, uniqueItems: true, items: { enum: ["codex", "cursor", "github-copilot", "claude"] } }),
        delivery: property("targets.delivery", { type: "array", minItems: 1, uniqueItems: true, items: { enum: ["workspace", "global", "cloud"] } })
      } }),
      installation: property("installation", { type: "object", additionalProperties: true, properties: { default: property("installation.default", { type: "boolean", default: false }) } }),
      metadata: property("metadata", { type: "object", additionalProperties: true, properties: {
        tags: property("metadata.tags", { type: "array", uniqueItems: true, default: [], items: { type: "string", minLength: 1 } }),
        icon: string("metadata.icon"), evaluation_score: property("metadata.evaluation_score", { type: "number", minimum: 0, maximum: 10 })
      } }),
      history: property("history", { type: "object", additionalProperties: true, properties: {
        previous_revision: string("history.previous_revision", { pattern: "^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$" }),
        migrations: property("history.migrations", { type: "array", minItems: 1, uniqueItems: true, items: property("history.migrations[]", { type: "object", required: ["from"], additionalProperties: true, properties: {
          from: property("history.migrations[].from", { type: "object", minProperties: 1, additionalProperties: true, properties: migrationFromProperties })
        } }) })
      } })
    }
  };
}
