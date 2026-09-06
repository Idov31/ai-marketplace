import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMarketplaceManifestJsonSchema } from "../packages/marketplace-core/out/services/manifestSchema.js";

const root = resolve(import.meta.dirname, "..");
const targets = [
  resolve(root, "schemas", "ai_marketplace.schema.json"),
  resolve(root, "plugins", "ai-marketplace", "schemas", "ai_marketplace.schema.json"),
  resolve(root, "plugins", "ai-marketplace-claude", "schemas", "ai_marketplace.schema.json")
];
const content = `${JSON.stringify(createMarketplaceManifestJsonSchema(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  const stale = [];
  for (const target of targets) if (await readFile(target, "utf8").catch(() => "") !== content) stale.push(target);
  if (stale.length) throw new Error(`Generated manifest schema is out of date at ${stale.join(", ")}. Run npm run generate:manifest-schema.`);
  process.stdout.write("AI Marketplace manifest schema matches the typed registry.\n");
} else {
  for (const target of targets) {
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, content);
    process.stdout.write(`${target}\n`);
  }
}
