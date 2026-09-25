import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

const output = "plugins/ai-marketplace-harness/dist";
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["plugins/ai-marketplace-harness/src/index.ts"],
  outfile: `${output}/index.js`,
  bundle: true,
  platform: "node",
  format: "esm",
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  target: "node22",
  packages: "bundle",
  external: ["node:*"],
  logLevel: "warning"
});
await copyFile("plugins/ai-marketplace-harness/src/client.js", `${output}/client.js`);
