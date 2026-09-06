import { chmod, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const entry = new URL("../packages/marketplace-node-cli/src/claudeMain.ts", import.meta.url);
const output = new URL("../plugins/ai-marketplace-claude/bin/ai-marketplace.cjs", import.meta.url);

await mkdir(new URL("../plugins/ai-marketplace-claude/bin/", import.meta.url), { recursive: true });
await build({
  entryPoints: [fileURLToPath(entry)],
  outfile: fileURLToPath(output),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: false,
  legalComments: "none",
});
await chmod(output, 0o755);
