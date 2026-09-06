import { isMap, parseDocument } from "yaml";
import { ValidationError } from "./validation";

const maxManifestBytes = 128 * 1024;

export function parseMarketplaceYaml(text: string, source: string): Record<string, unknown> {
  if (Buffer.byteLength(text, "utf8") > maxManifestBytes) throw new ValidationError(`AI Marketplace manifest at ${source} exceeds the 128 KiB size limit.`);
  const document = parseDocument(text, { strict: true, uniqueKeys: true, prettyErrors: false });
  if (document.errors.length > 0) throw new ValidationError(`AI Marketplace manifest at ${source} is invalid YAML: ${document.errors[0].message}`);
  if (!isMap(document.contents)) throw new ValidationError(`AI Marketplace manifest at ${source} must contain a top-level mapping.`);
  let value: unknown;
  try { value = document.toJS({ maxAliasCount: 0 }); }
  catch (error) { throw new ValidationError(`AI Marketplace manifest at ${source} contains unsafe YAML aliases: ${error instanceof Error ? error.message : String(error)}`); }
  if (!isRecord(value)) throw new ValidationError(`AI Marketplace manifest at ${source} must contain a top-level mapping.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
