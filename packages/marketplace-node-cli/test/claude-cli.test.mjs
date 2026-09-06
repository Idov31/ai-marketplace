import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const claudeCli = fileURLToPath(new URL("../../../plugins/ai-marketplace-claude/bin/ai-marketplace.cjs", import.meta.url));
const codexCli = fileURLToPath(new URL("../../../plugins/ai-marketplace/bin/ai-marketplace.cjs", import.meta.url));

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-claude-cli-"));
  const home = join(root, "home");
  const workspace = join(root, "workspace");
  await mkdir(home);
  await mkdir(workspace);
  return { home, workspace };
}

function run(cli, args, fixture) {
  const result = spawnSync(process.execPath, [cli, ...args, "--workspace", fixture.workspace], {
    encoding: "utf8",
    env: { ...process.env, HOME: fixture.home, USERPROFILE: fixture.home }
  });
  return { ...result, json: result.stdout ? JSON.parse(result.stdout) : undefined };
}

test("Claude config defaults use the host-specific path", async () => {
  const f = await fixture();
  const shown = run(claudeCli, ["config", "show"], f);
  assert.equal(shown.status, 0);
  assert.deepEqual(shown.json.config, { schemaVersion: 1 });

  const dry = run(claudeCli, ["config", "auto-update", "set", "true"], f);
  assert.equal(dry.status, 0);
  assert.equal(dry.json.plan.path, "~/.ai_marketplace/claude.json");
  const applied = run(claudeCli, ["config", "auto-update", "set", "true", "--apply", "--plan-id", dry.json.planId], f);
  assert.equal(applied.status, 0);
  assert.equal(JSON.parse(await readFile(join(f.home, ".ai_marketplace", "claude.json"), "utf8")).autoUpdate, true);
  await assert.rejects(readFile(join(f.home, ".ai_marketplace", "codex.json")), { code: "ENOENT" });
});

test("Claude CLI rejects other platform selectors", async () => {
  const f = await fixture();
  const accepted = run(claudeCli, ["installed", "list", "--platform", "claude"], f);
  assert.equal(accepted.status, 0);
  const rejected = run(claudeCli, ["installed", "list", "--platform", "codex"], f);
  assert.equal(rejected.status, 2);
  assert.equal(rejected.json.error.code, "VALIDATION");
  assert.match(rejected.json.error.message, /Only platform 'claude'/);
});

test("offline installed listing returns only Claude records", async () => {
  const f = await fixture();
  const statePath = join(f.workspace, ".ai_marketplace", "installed.json");
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ schemaVersion: 2, packages: [installed("claude-demo", "claude"), installed("codex-demo", "codex")] }));
  const result = run(claudeCli, ["installed", "list", "--scope", "workspace"], f);
  assert.equal(result.status, 0);
  assert.equal(result.json.count, 1);
  assert.equal(result.json.packages[0].id, "claude-demo");
});

test("equivalent host plans have host-qualified fingerprints", async () => {
  const claudeFixture = await fixture();
  const codexFixture = await fixture();
  const args = ["config", "auto-update", "set", "true"];
  const claude = run(claudeCli, args, claudeFixture);
  const codex = run(codexCli, args, codexFixture);
  assert.equal(claude.status, 0);
  assert.equal(codex.status, 0);
  assert.notEqual(claude.json.planId, codex.json.planId);
});

test("Claude mutations honor the shared operation lock", async () => {
  const f = await fixture();
  const dry = run(claudeCli, ["config", "auto-update", "set", "true"], f);
  const lock = join(f.home, ".ai_marketplace", ".operation.lock");
  await mkdir(dirname(lock), { recursive: true });
  await writeFile(lock, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
  const result = run(claudeCli, ["config", "auto-update", "set", "true", "--apply", "--plan-id", dry.json.planId], f);
  assert.equal(result.status, 5);
  assert.match(result.json.error.message, /operation holds/);
});

function installed(id, platform) {
  return { id, type: "skill", platform, scope: "workspace", version: "1.0.0", sourceRepo: "owner/repo", sourceBranch: "main", sourcePath: `Skills/${id}`, sourceId: "default", qualifiedName: `@demo/${id}`, group: "demo", installedPath: platform === "claude" ? `.claude/skills/${id}` : `.codex/skills/${id}`, installedAt: "2026-08-08T00:00:00.000Z" };
}
