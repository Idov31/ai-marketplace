import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const extension = join(root, "packages", "vscode-plugin");
const outFlag = process.argv.indexOf("--out");
if (outFlag >= 0 && !process.argv[outFlag + 1]) throw new Error("--out requires a destination path");

const manifest = JSON.parse(readFileSync(join(extension, "package.json"), "utf8"));
const target = outFlag >= 0
  ? resolve(process.argv[outFlag + 1])
  : join(root, "dist", `ai-marketplace-${manifest.version}.vsix`);
const vsce = join(root, "node_modules", "@vscode", "vsce", "vsce");

mkdirSync(dirname(target), { recursive: true });
execFileSync(process.execPath, [vsce, "package", "--no-dependencies", "--out", target], { cwd: extension, stdio: "inherit" });
process.stdout.write(`${target}\n`);
