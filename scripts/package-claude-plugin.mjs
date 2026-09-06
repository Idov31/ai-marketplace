import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { resolveNpmCli } from "./npm-cli.mjs";

const root = resolve(import.meta.dirname, "..");
const plugin = join(root, "plugins", "ai-marketplace-claude");
const npmCli = resolveNpmCli();
const temporary = mkdtempSync(join(tmpdir(), "ai-marketplace-claude-pack-"));
const outFlag = process.argv.indexOf("--out");
if (outFlag >= 0 && !process.argv[outFlag + 1]) {
  throw new Error("--out requires a destination path");
}

try {
  execFileSync(process.platform === "win32" ? "python" : "python3", [
    join(root, "scripts", "validate-claude-plugin.py"),
  ], { cwd: root, stdio: "inherit" });

  const archives = ["one", "two"].map((name) => {
    const destination = join(temporary, name);
    mkdirSync(destination, { recursive: true });
    const result = JSON.parse(execFileSync(
      process.execPath,
      [npmCli, "pack", plugin, "--json", "--pack-destination", destination, "--cache", join(temporary, "npm-cache")],
      { cwd: root, encoding: "utf8" },
    ));
    return join(destination, result[0].filename);
  });

  const contents = archives.map((archive) => readFileSync(archive));
  const digests = contents.map((content) => createHash("sha256").update(content).digest("hex"));
  if (digests[0] !== digests[1]) {
    throw new Error(`Claude plugin packaging is not deterministic: ${digests.join(" != ")}`);
  }

  const manifest = JSON.parse(readFileSync(join(plugin, ".claude-plugin", "plugin.json"), "utf8"));
  const target = outFlag >= 0
    ? resolve(process.argv[outFlag + 1])
    : join(root, "dist", `ai-marketplace-claude-plugin-${manifest.version}.tgz`);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(archives[0], target);
  process.stdout.write(`${target}\nsha256 ${digests[0]}\n`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
