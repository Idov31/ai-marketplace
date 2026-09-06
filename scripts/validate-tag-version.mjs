import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!tag) throw new Error("Provide a release tag or set GITHUB_REF_NAME.");

const releases = {
  vscode: ["packages/vscode-plugin/package.json"],
  codex: ["plugins/ai-marketplace/package.json", "plugins/ai-marketplace/.codex-plugin/plugin.json"],
  claude: ["plugins/ai-marketplace-claude/package.json", "plugins/ai-marketplace-claude/.claude-plugin/plugin.json", ".claude-plugin/marketplace.json"]
};

const match = /^(vscode|codex|claude)-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(tag);
if (!match) throw new Error(`Release tag '${tag}' must match vscode-vX.Y.Z, codex-vX.Y.Z, or claude-vX.Y.Z.`);

const [, target, major, minor, patch] = match;
const expected = `${major}.${minor}.${patch}`;
for (const file of releases[target]) {
  const manifest = JSON.parse(readFileSync(resolve(root, file), "utf8"));
  const actual = file === ".claude-plugin/marketplace.json" ? manifest.plugins?.[0]?.version : manifest.version;
  if (actual !== expected) throw new Error(`${file} version '${actual}' does not match release tag '${tag}'.`);
}

process.stdout.write(`${target} release tag matches version ${expected}.\n`);
