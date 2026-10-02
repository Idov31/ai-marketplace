import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const destination = resolve(root, "dist");
await mkdir(destination, { recursive: true });
if (!process.env.npm_execpath) throw new Error("Run this script through npm.cmd run package:harness.");
execFileSync(process.execPath, [process.env.npm_execpath, "pack", "./plugins/ai-marketplace-harness", "--pack-destination", destination], {
  cwd: root, stdio: "inherit"
});
