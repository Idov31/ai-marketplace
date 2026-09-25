import { parseDocument, stringify } from "yaml";
import { ValidationError } from "./validation";

export interface HarnessPresetRootsPatch {
  readonly content: string;
  readonly roots: readonly Readonly<Record<string, unknown>>[];
}

export function hasHarnessPresetPatchEntry(content: string | undefined): boolean {
  const { rows } = parsePatch(content);
  return findPresetRow(rows) !== undefined;
}

export function addHarnessPresetRoot(
  content: string | undefined,
  path: string,
  alreadyOwned = false,
  baseConfig?: Readonly<Record<string, unknown>>
): HarnessPresetRootsPatch {
  const { document, rows } = parsePatch(content);
  let row = findPresetRow(rows);
  if (!row) {
    if (!baseConfig) throw new ValidationError("Unable to resolve the Harness profile's agent-presets defaults.");
    row = { id: "agent-presets", config: baseConfig };
    document.add(row);
    rows.push(row);
  }
  const roots = rootsOf(row);
  const current = roots.find((root) => root.path === path);
  if (current) {
    if (!alreadyOwned || !isOwnedRoot(current, path)) throw new ValidationError("The Harness preset root already exists outside Marketplace ownership or was modified.");
    return { content: document.toString(), roots };
  }
  const nextRoots = [...roots, { path, trust: "system" }];
  const index = rows.indexOf(row);
  document.setIn([index, "config", "roots"], nextRoots);
  return { content: document.toString(), roots: nextRoots };
}

export function removeHarnessPresetRoot(
  content: string | undefined,
  path: string,
  removeGeneratedEntry = false,
  baseConfig?: Readonly<Record<string, unknown>>
): HarnessPresetRootsPatch | undefined {
  const { document, rows } = parsePatch(content);
  const row = findPresetRow(rows);
  if (!row) return undefined;
  const roots = rootsOf(row);
  const current = roots.find((root) => root.path === path);
  if (current && !isOwnedRoot(current, path)) throw new ValidationError("The Marketplace-owned Harness preset root was modified and will not be removed.");
  const nextRoots = roots.filter((root) => root.path !== path);
  if (nextRoots.length === roots.length) return undefined;
  const rowIndex = rows.indexOf(row);
  const config = isRecord(row.config) ? row.config : {};
  const nextConfig = { ...config, roots: nextRoots };
  const comparableConfig = nextRoots.length === 0 && !Array.isArray(baseConfig?.roots)
    ? Object.fromEntries(Object.entries(nextConfig).filter(([key]) => key !== "roots"))
    : nextConfig;
  if (removeGeneratedEntry && baseConfig && sameValue(comparableConfig, baseConfig)) {
    document.deleteIn([rowIndex]);
  } else if (nextRoots.length === 0) {
    document.deleteIn([rowIndex, "config", "roots"]);
  } else {
    document.setIn([rowIndex, "config", "roots"], nextRoots);
  }
  return { content: document.toString(), roots: nextRoots };
}

/** Resolve the last complete agent-presets config found in ordered bundle layers. */
export function resolveHarnessPresetConfig(layers: readonly string[]): Readonly<Record<string, unknown>> | undefined {
  let result: Readonly<Record<string, unknown>> | undefined;
  for (const layer of layers) {
    const { rows } = parsePatch(layer);
    for (const operation of rows) {
      const candidates = operation.id === "agent-presets" ? [operation]
        : Array.isArray(operation.insert) ? operation.insert.filter(isRecord) : [];
      for (const candidate of candidates) {
        if (candidate.id === "agent-presets" && isRecord(candidate.config)) result = candidate.config;
      }
    }
  }
  return result;
}

function parsePatch(content: string | undefined): { document: ReturnType<typeof parseDocument>; rows: Array<Record<string, unknown>> } {
  const document = parseDocument(content === undefined || content.trim() === "" ? "[]\n" : content, { uniqueKeys: true });
  const value: unknown = document.toJS();
  if (document.errors.length || !Array.isArray(value) || value.some((row) => !isRecord(row))) {
    throw new ValidationError("DeepSeek Harness profile cordis.patch.yml is invalid; preset configuration was not changed.");
  }
  return { document, rows: value as Array<Record<string, unknown>> };
}

function findPresetRow(rows: Array<Record<string, unknown>>): Record<string, unknown> | undefined {
  const matches = rows.filter((row) => row.id === "agent-presets");
  if (matches.length > 1) throw new ValidationError("Harness profile has multiple agent-presets patch entries.");
  if (matches[0]) return matches[0];
  return undefined;
}

function rootsOf(row: Record<string, unknown>): Readonly<Record<string, unknown>>[] {
  const config = row.config === undefined ? {} : row.config;
  if (!isRecord(config)) throw new ValidationError("Harness agent-presets patch config is not an object.");
  const roots = config.roots === undefined ? [] : config.roots;
  if (!Array.isArray(roots) || roots.some((root) => !isRecord(root) || typeof root.path !== "string")) {
    throw new ValidationError("Harness agent-presets roots are invalid.");
  }
  return roots as Readonly<Record<string, unknown>>[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOwnedRoot(root: Readonly<Record<string, unknown>>, path: string): boolean {
  return root.path === path && root.trust === "system" && Object.keys(root).length === 2;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => sameValue(item, right[index]));
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
  }
  return left === right;
}
import { createHash } from "node:crypto";
