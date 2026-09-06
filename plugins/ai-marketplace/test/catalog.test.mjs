import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
const { runCli } = createRequire(import.meta.url)("../.test-build/cli.cjs");

test("catalog filtering and workspace install share the core GitHub and installer logic", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-network-"));
  const home = join(root, "home"); const workspace = join(root, "workspace");
  await mkdir(home); await mkdir(workspace);
  const originalFetch = globalThis.fetch; globalThis.fetch = mockGitHub;
  t.after(() => { globalThis.fetch = originalFetch; });

  const listed = await invoke(["catalog", "list", "--type", "skill", "--search", "demo", "--workspace", workspace], home);
  assert.equal(listed.code, 0); assert.equal(listed.json.count, 1); assert.equal(listed.json.packages[0].identity, "default:@demo/demo-skill");

  const dry = await invoke(["package", "install", "default:@demo/demo-skill", "--workspace", workspace], home);
  assert.equal(dry.code, 0); assert.equal(dry.json.applied, false);
  await assert.rejects(readFile(join(workspace, ".codex", "skills", "demo-skill", "SKILL.md")), { code: "ENOENT" });

  const applied = await invoke(["package", "install", "default:@demo/demo-skill", "--apply", "--plan-id", dry.json.planId, "--workspace", workspace], home);
  assert.equal(applied.code, 0); assert.equal(applied.json.applied, true);
  assert.equal(await readFile(join(workspace, ".codex", "skills", "demo-skill", "SKILL.md"), "utf8"), "# Demo\n");
  const state = JSON.parse(await readFile(join(workspace, ".ai_marketplace", "installed.json"), "utf8"));
  assert.equal(state.packages[0].platform, "codex"); assert.equal(state.packages[0].sourceId, "default");

  const globalStatePath = join(home, ".ai_marketplace", "installed.json");
  await mkdir(join(home, ".ai_marketplace"), { recursive: true });
  await writeFile(globalStatePath, JSON.stringify({ schemaVersion: 2, packages: [{
    id: "old-mcp", qualifiedName: "@demo/old-mcp", sourceId: "default", group: "demo", type: "mcp", platform: "codex", scope: "global", version: "1.0.0",
    sourceRepo: "owner/repo", sourceBranch: "main", sourcePath: "Mcps/old", installedPath: ".codex/config.toml", installedAt: "2026-08-01T00:00:00.000Z"
  }] }));
  const migration = await invoke(["package", "migrate", "default:@demo/new-mcp", "--workspace", workspace], home);
  assert.equal(migration.code, 0, migration.stderr);
  assert.equal(migration.json.plan.scope, "global");
});

async function invoke(args, home) {
  let stdout = ""; let stderr = "";
  const code = await runCli(args, { stdout: (value) => { stdout += value; }, stderr: (value) => { stderr += value; }, env: {}, home });
  return { code, stderr, json: JSON.parse(stdout) };
}

async function mockGitHub(input) {
  const url = new URL(String(input));
  if (url.pathname.includes("/git/trees/")) return json({ sha: "a".repeat(40), tree: [
    { path: "Skills/demo/ai_marketplace.yaml", type: "blob", sha: "1".repeat(40) },
    { path: "Skills/demo/SKILL.md", type: "blob", sha: "2".repeat(40) },
    { path: "Mcps/new/ai_marketplace.yaml", type: "blob", sha: "3".repeat(40) },
    { path: "Mcps/new/mcp.json", type: "blob", sha: "4".repeat(40) },
    { path: "Mcps/new/install.py", type: "blob", sha: "5".repeat(40) },
    { path: "Mcps/new/uninstall.py", type: "blob", sha: "6".repeat(40) }
  ] });
  if (url.pathname.endsWith(`/git/blobs/${"1".repeat(40)}`)) return blob(`schema_version: 1\nminimum_reader_schema_version: 1\npackage:\n  name: "@demo/demo-skill"\n  group: demo\n  type: skill\n  version: 1.0.0\n  description: Demo package\n  entrypoint: SKILL.md\ntargets:\n  platforms: [codex]\n  delivery: [workspace, global]\nmetadata:\n  tags: [demo]\n`);
  if (url.pathname.endsWith(`/git/blobs/${"2".repeat(40)}`)) return blob("# Demo\n");
  if (url.pathname.endsWith(`/git/blobs/${"3".repeat(40)}`)) return blob(`schema_version: 1\nminimum_reader_schema_version: 1\npackage:\n  name: "@demo/new-mcp"\n  group: demo\n  type: mcp\n  version: 1.0.0\n  description: New MCP\n  entrypoint: mcp.json\ntargets:\n  platforms: [codex]\n  delivery: [global]\nmetadata:\n  tags: [demo]\nhistory:\n  migrations:\n    - from:\n        name: "@demo/old-mcp"\n`);
  if (url.pathname.endsWith(`/git/blobs/${"4".repeat(40)}`)) return blob(JSON.stringify({ codex: { mcp_servers: { "new-mcp": { command: "new" } } } }));
  return json({ message: "Not Found" }, 404);
}
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } }); }
function blob(value) { return json({ encoding: "base64", content: Buffer.from(value).toString("base64") }); }
