import { chmod, copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

await mkdir(new URL("../bin/", import.meta.url), { recursive: true });
for (const name of ["LICENSE", "PRIVACY.md", "SUPPORT.md", "TERMS.md"]) {
  await copyFile(new URL(`../../../${name}`, import.meta.url), new URL(`../${name}`, import.meta.url));
}
await build({
  entryPoints: [fileURLToPath(new URL("../src/main.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("../bin/ai-marketplace.cjs", import.meta.url)),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: false,
  legalComments: "none"
});
await build({
  entryPoints: [fileURLToPath(new URL("../src/cli.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("../.test-build/cli.cjs", import.meta.url)),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: false,
  legalComments: "none"
});
await chmod(new URL("../bin/ai-marketplace.cjs", import.meta.url), 0o755);
