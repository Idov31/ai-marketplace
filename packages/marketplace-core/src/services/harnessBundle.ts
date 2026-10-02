import { createHash } from "node:crypto";
import { parseDocument } from "yaml";
import type { MarketplacePackage, PackageFile } from "../types/packages";
import { safeJoinRelative } from "./pathPlanning";
import { ValidationError } from "./validation";
import { assertMcpPackageScripts } from "./mcpScripts";

export interface HarnessBundle {
  readonly name: string;
  readonly patchPath: string;
  readonly contentSha256: string;
  readonly presetRoot?: string;
}

/** A Harness bundle is a prebuilt npm package with a Cordis patch layer. */
export function validateHarnessBundle(pkg: MarketplacePackage, files: readonly PackageFile[]): HarnessBundle {
  if (!files.some((file) => file.relativePath === pkg.manifest.entrypoint)) {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing its catalog entrypoint '${pkg.manifest.entrypoint}'.`);
  }
  const entrypoint = files.find((file) => file.relativePath === "package.json");
  if (!entrypoint) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing package.json.`);
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(entrypoint.content).toString("utf8")) as unknown; }
  catch { throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has invalid package.json.`); }
  if (!isRecord(parsed) || typeof parsed.name !== "string" || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(parsed.name)
    || parsed.version !== pkg.manifest.version || !isRecord(parsed.dsh) || !isRecord(parsed.dsh.bundle)) {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' requires a matching npm name, version, and dsh.bundle declaration.`);
  }
  if (pkg.manifest.type === "mcp") assertMcpPackageScripts(pkg, files);
  const patch = parsed.dsh.bundle.patch;
  if (typeof patch !== "string") throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' requires dsh.bundle.patch.`);
  const patchPath = safeJoinRelative(patch.replace(/^\.\//, ""));
  if (!/^cordis\.patch\.ya?ml$/.test(patchPath)) {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' must use a root cordis.patch.yml file.`);
  }
  const patchFile = files.find((file) => file.relativePath === patchPath);
  if (!patchFile) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing '${patchPath}'.`);
  const document = parseDocument(Buffer.from(patchFile.content).toString("utf8"), { uniqueKeys: true });
  const patchValue: unknown = document.toJS();
  if (document.errors.length > 0 || !Array.isArray(patchValue) || patchValue.length === 0) {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has an invalid or empty Cordis patch.`);
  }
  const rows = patchValue.flatMap((operation: unknown) => isRecord(operation) && Array.isArray(operation.insert) ? operation.insert as unknown[] : []);
  const expectedName = parsed.name;
  const hasContribution = rows.some((row) => isRecord(row) && typeof row.id === "string" && row.id.length > 0
    && typeof row.name === "string" && (row.name === expectedName || row.name.startsWith(`${expectedName}/`)
      || (pkg.manifest.type === "mcp" && row.name === "@deepseek-ai/dsh-mcp-client")));
  if (!hasContribution) {
    throw new ValidationError(`DeepSeek Harness ${pkg.manifest.type} package '${pkg.manifest.id}' must insert a plugin contribution from its bundle.`);
  }
  const scripts = parsed.scripts;
  if (isRecord(scripts) && ["preinstall", "install", "postinstall", "prepare"].some((key) => key in scripts)) {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' must be prebuilt and contain no install lifecycle scripts.`);
  }
  const paths = new Set<string>();
  for (const file of files) {
    const path = safeJoinRelative(file.relativePath);
    if (paths.has(path)) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' contains duplicate file '${path}'.`);
    paths.add(path);
  }
  const entry = typeof parsed.main === "string" ? parsed.main : undefined;
  if (entry) {
    const mainPath = safeJoinRelative(entry.replace(/^\.\//, ""));
    if (!paths.has(mainPath)) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing main module '${mainPath}'.`);
  } else if (pkg.manifest.type !== "mcp") {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' requires a prebuilt main module.`);
  }
  const exportsValue = parsed.exports;
  if (exportsValue !== undefined && !isRecord(exportsValue) && typeof exportsValue !== "string") {
    throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has invalid exports.`);
  }
  const checkReference = (reference: unknown): void => {
    if (typeof reference === "string") {
      if (!reference.startsWith("./")) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has an external entrypoint reference.`);
      const target = safeJoinRelative(reference.slice(2));
      if (!paths.has(target)) throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' is missing referenced file '${target}'.`);
    } else if (isRecord(reference)) {
      for (const nested of Object.values(reference)) checkReference(nested);
    } else {
      throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has invalid entrypoint exports.`);
    }
  };
  if (exportsValue !== undefined) checkReference(exportsValue);
  if (isRecord(parsed.dsh.client)) {
    if (!isRecord(exportsValue) || exportsValue["./client"] === undefined) {
      throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' declares dsh.client without a client export.`);
    }
  }
  for (const row of rows) {
    if (!isRecord(row) || typeof row.name !== "string" || !row.name.startsWith(`${expectedName}/`)) continue;
    const subpath = `.${row.name.slice(expectedName.length)}`;
    if (!isRecord(exportsValue) || exportsValue[subpath] === undefined) {
      throw new ValidationError(`DeepSeek Harness package '${pkg.manifest.id}' has no export for patch plugin '${row.name}'.`);
    }
  }
  const digest = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
    digest.update(file.relativePath).update("\0").update(file.content).update("\0");
  }
  const presetRootValue = parsed.dsh.bundle.presetRoot;
  let presetRoot: string | undefined;
  if (pkg.manifest.type === "agent") {
    if (typeof presetRootValue !== "string") throw new ValidationError(`DeepSeek Harness agent '${pkg.manifest.id}' must declare dsh.bundle.presetRoot.`);
    presetRoot = safeJoinRelative(presetRootValue.replace(/^\.\//, ""));
    if (![...paths].some((path) => path.startsWith(`${presetRoot}/`) && path.endsWith("/agent.cordis.yml"))) {
      throw new ValidationError(`DeepSeek Harness agent '${pkg.manifest.id}' is missing a preset composition under '${presetRoot}'.`);
    }
  }
  return { name: parsed.name, patchPath, contentSha256: digest.digest("hex"), ...(presetRoot ? { presetRoot } : {}) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
