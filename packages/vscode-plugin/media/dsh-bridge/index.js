import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const name = "ai-marketplace-dsh-bridge";
export const inject = ["systemPrompt"];

export function apply(ctx) {
  ctx.effect(() => ctx.systemPrompt.section({
    name: "ai-marketplace:rules",
    order: 75,
    interpolate: false,
    text: ({ agent }) => collectRules(agent?.session?.header?.cwd)
  }), "AI Marketplace rule instructions");
}

export function collectRules(cwd, dshHome = process.env.DSH_HOME || join(homedir(), ".dsh")) {
  const profile = activeProfile();
  const roots = [{ path: join(dshHome, "rules"), scope: "global", state: join(homedir(), ".ai_marketplace", "installed.json") }];
  if (typeof cwd === "string" && cwd.length > 0) {
    const root = projectRoot(cwd);
    roots.push({ path: join(root, ".dsh", "rules"), scope: "workspace", state: join(root, ".ai_marketplace", "installed.json") });
  }
  const sections = [];
  let remaining = 65_536;
  for (const root of roots) {
    if (!isDirectory(root.path)) continue;
    const managed = managedRuleIds(root.state, root.scope, profile);
    for (const name of readdirSync(root.path).sort()) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(name)) continue;
      if (!managed.has(name)) continue;
      const file = join(root.path, name, "RULE.md");
      if (!isRegularFile(file)) continue;
      const content = readFileSync(file, "utf8").trim();
      const bytes = Buffer.byteLength(content, "utf8");
      if (bytes === 0 || bytes > remaining) continue;
      sections.push(`## ${name}\n${content}`);
      remaining -= bytes;
    }
  }
  return sections.length ? `# AI Marketplace rules\n\n${sections.join("\n\n")}` : "";
}

function activeProfile() {
  const index = process.argv.indexOf("--profile");
  const candidate = index >= 0 ? process.argv[index + 1] : "web";
  return typeof candidate === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(candidate) ? candidate : "web";
}

function managedRuleIds(statePath, scope, profile) {
  if (!isRegularFile(statePath)) return new Set();
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    return new Set((Array.isArray(state.packages) ? state.packages : [])
      .filter((item) => item?.platform === "deepseek-harness" && item?.type === "rule"
        && item?.scope === scope && item?.harnessProfile === profile
        && item?.installedPath === `.dsh/rules/${item.id}`)
      .map((item) => item.id));
  } catch { return new Set(); }
}

function projectRoot(cwd) {
  let current = resolve(cwd);
  while (true) {
    if (existsSync(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(cwd);
    current = parent;
  }
}

function isDirectory(path) {
  try { return lstatSync(path).isDirectory(); } catch { return false; }
}

function isRegularFile(path) {
  try { return lstatSync(path).isFile(); } catch { return false; }
}
