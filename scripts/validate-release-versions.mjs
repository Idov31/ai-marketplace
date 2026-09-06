import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
let changed;
try { changed = execFileSync("git", ["diff", "--name-only", "HEAD^", "HEAD"], { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter(Boolean); }
catch { process.stdout.write("Skipping release version validation because the previous commit is unavailable.\n"); process.exit(0); }

const releases = [
  { label: "shared core", manifest: "packages/marketplace-core/package.json", affected: (path) => path.startsWith("packages/marketplace-core/src/") || path === "packages/marketplace-core/package.json" },
  { label: "shared Node CLI", manifest: "packages/marketplace-node-cli/package.json", affected: (path) => path.startsWith("packages/marketplace-node-cli/src/") || path === "packages/marketplace-node-cli/package.json" },
  { label: "VS Code extension", manifest: "packages/vscode-plugin/package.json", affected: (path) => path.startsWith("packages/marketplace-core/src/") || path.startsWith("packages/vscode-plugin/src/") || path.startsWith("packages/vscode-plugin/media/") || path === "packages/vscode-plugin/package.json" },
  { label: "Codex plugin", manifest: "plugins/ai-marketplace/package.json", affected: (path) => path.startsWith("packages/marketplace-core/src/") || path.startsWith("packages/marketplace-node-cli/src/") || path.startsWith("plugins/ai-marketplace/src/") || path.startsWith("plugins/ai-marketplace/dashboard/") || path.startsWith("plugins/ai-marketplace/skills/") || path.startsWith("plugins/ai-marketplace/assets/") || path === "plugins/ai-marketplace/.codex-plugin/plugin.json" || path === "plugins/ai-marketplace/package.json" },
  { label: "Claude plugin", manifest: "plugins/ai-marketplace-claude/package.json", affected: (path) => path.startsWith("packages/marketplace-core/src/") || path.startsWith("packages/marketplace-node-cli/src/") || path.startsWith("plugins/ai-marketplace-claude/") || path === ".claude-plugin/marketplace.json" }
];
const failures = [];
for (const release of releases) {
  if (!changed.some(release.affected)) continue;
  const current = JSON.parse(readFileSync(resolve(root, release.manifest), "utf8")).version;
  let previous;
  try { previous = JSON.parse(execFileSync("git", ["show", `HEAD^:${release.manifest}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })).version; }
  catch { continue; }
  if (!isStrictlyNewer(current, previous)) failures.push(`${release.label} runtime files changed, but version '${current}' is not newer than '${previous}'.`);
}
if (failures.length) throw new Error(failures.join("\n"));
process.stdout.write("Release versions match the changed runtime surfaces.\n");

function isStrictlyNewer(current, previous) {
  const left = semver(current); const right = semver(previous); if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) if (left[index] !== right[index]) return left[index] > right[index];
  return false;
}
function semver(value) { const match = typeof value === "string" ? /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value) : undefined; return match ? match.slice(1).map(Number) : undefined; }
