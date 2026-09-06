import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/ai-marketplace.cjs", import.meta.url));
const { filesystemErrorMessage } = createRequire(import.meta.url)("../.test-build/cli.cjs");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-cli-"));
  const home = join(root, "home");
  const workspace = join(root, "workspace");
  await mkdir(home); await mkdir(workspace);
  return { root, home, workspace };
}

function run(args, options) {
  const result = spawnSync(process.execPath, [cli, ...args, "--workspace", options.workspace], {
    encoding: "utf8",
    env: { ...process.env, HOME: options.home, USERPROFILE: options.home, ...options.env }
  });
  return { ...result, json: result.stdout ? JSON.parse(result.stdout) : undefined };
}

test("config show uses defaults and emits only JSON on stdout", async () => {
  const f = await fixture();
  const result = run(["config", "show"], f);
  assert.equal(result.status, 0);
  assert.deepEqual(result.json.config, { schemaVersion: 1 });
  assert.equal(result.stderr, "");
});

test("package migration is an explicit CLI action", async () => {
  const f = await fixture();
  const result = run(["package", "migrate"], f);
  assert.equal(result.status, 2);
  assert.match(result.json.error.message, /install\|update\|migrate\|revert/);
});

test("credential precedence is reported without exposing token values", async () => {
  const f = await fixture();
  const result = run(["config", "show"], { ...f, env: { GH_TOKEN: "primary-secret", GITHUB_TOKEN: "fallback-secret" } });
  assert.equal(result.json.credentialSource, "GH_TOKEN");
  assert.doesNotMatch(result.stdout + result.stderr, /primary-secret|fallback-secret/);
});

test("configuration mutations are dry-run by default and persist only with apply", async () => {
  const f = await fixture();
  const dry = run(["config", "auto-update", "set", "true"], f);
  assert.equal(dry.status, 0); assert.equal(dry.json.applied, false);
  await assert.rejects(readFile(join(f.home, ".ai_marketplace", "codex.json")), { code: "ENOENT" });
  const applied = run(["config", "auto-update", "set", "true", "--apply", "--plan-id", dry.json.planId], f);
  assert.equal(applied.status, 0); assert.equal(applied.json.applied, true);
  assert.equal(JSON.parse(await readFile(join(f.home, ".ai_marketplace", "codex.json"), "utf8")).autoUpdate, true);
});

test("installed list reads workspace and global state without network access", async () => {
  const f = await fixture();
  const statePath = join(f.workspace, ".ai_marketplace", "installed.json");
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ schemaVersion: 2, packages: [installed("demo", "workspace")] }));
  const result = run(["installed", "list", "--scope", "workspace"], f);
  assert.equal(result.status, 0); assert.equal(result.json.count, 1); assert.equal(result.json.packages[0].id, "demo");
});

test("uninstall plans first and changes files only with apply", async () => {
  const f = await fixture();
  const packagePath = join(f.workspace, ".codex", "skills", "demo");
  await mkdir(packagePath, { recursive: true }); await writeFile(join(packagePath, "SKILL.md"), "demo");
  const statePath = join(f.workspace, ".ai_marketplace", "installed.json");
  await mkdir(dirname(statePath), { recursive: true }); await writeFile(statePath, JSON.stringify({ schemaVersion: 2, packages: [installed("demo", "workspace")] }));
  const dry = run(["package", "uninstall", "demo"], f);
  assert.equal(dry.status, 0); assert.equal(dry.json.applied, false);
  assert.deepEqual(dry.json.plan.paths, [".codex/skills/demo", ".offload/codex/skills/demo", ".ai_marketplace/installed.json"]);
  assert.equal(await readFile(join(packagePath, "SKILL.md"), "utf8"), "demo");
  const applied = run(["package", "uninstall", "demo", "--apply", "--plan-id", dry.json.planId], f);
  assert.equal(applied.status, 0); assert.equal(applied.json.applied, true);
  await assert.rejects(readFile(join(packagePath, "SKILL.md")), { code: "ENOENT" });
  assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")).packages, []);
});

test("MCP plans disclose package-supplied script execution", async () => {
  const f = await fixture();
  const payload = ".ai_marketplace/mcp-packages/codex/default/demo";
  const statePath = join(f.home, ".ai_marketplace", "installed.json");
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ schemaVersion: 2, packages: [{
    ...installed("demo", "global"), type: "mcp", installedPath: ".codex/config.toml", managedPayloadPath: payload,
    managedConfig: { kind: "mcp", serverName: "demo", serverConfig: { command: "demo" } }
  }] }));

  const dry = run(["package", "uninstall", "demo", "--scope", "global"], f);

  assert.equal(dry.status, 0);
  assert.deepEqual(dry.json.plan.executions, [{ script: `${payload}/uninstall.py`, action: "uninstall", platform: "codex" }]);
  assert.ok(dry.json.plan.paths.includes(payload));
});

test("hotload and offload plans expose source, destination, and state paths", async () => {
  const f = await fixture(); const statePath = join(f.workspace, ".ai_marketplace", "installed.json");
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ schemaVersion: 2, packages: [installed("demo", "workspace")] }));
  const offload = run(["package", "offload", "demo"], f);
  assert.deepEqual(offload.json.plan.paths, [".codex/skills/demo", ".offload/codex/skills/demo", ".ai_marketplace/installed.json"]);
  await writeFile(statePath, JSON.stringify({ schemaVersion: 2, packages: [{ ...installed("demo", "workspace"), installedPath: ".offload/codex/skills/demo", hotloaded: false }] }));
  const hotload = run(["package", "hotload", "demo"], f);
  assert.deepEqual(hotload.json.plan.paths, [".offload/codex/skills/demo", ".codex/skills/demo", ".ai_marketplace/installed.json"]);
});

test("rejects cloud and non-Codex platform requests with validation exit", async () => {
  const f = await fixture();
  for (const args of [["installed", "list", "--scope", "cloud"], ["installed", "list", "--platform", "claude"]]) {
    const result = run(args, f);
    assert.equal(result.status, 2); assert.equal(result.json.ok, false); assert.equal(result.json.error.code, "VALIDATION");
  }
});

test("requires an explicit absolute workspace root", async () => {
  const f = await fixture();
  const result = spawnSync(process.execPath, [cli, "config", "show", "--workspace", "relative"], { encoding: "utf8", env: { ...process.env, HOME: f.home, USERPROFILE: f.home } });
  assert.equal(result.status, 2); assert.equal(JSON.parse(result.stdout).error.code, "VALIDATION");
});

test("rejects a symlink workspace root", async (t) => {
  const f = await fixture();
  const link = join(f.root, "workspace-link");
  try { await symlink(f.workspace, link, "dir"); } catch (error) { if (error.code === "EPERM") return t.skip("symlinks unavailable"); throw error; }
  const result = run(["installed", "list"], { ...f, workspace: link });
  assert.equal(result.status, 5); assert.equal(result.json.error.code, "FILESYSTEM_OR_SECURITY");
});

test("rejects unsafe repository configuration before writing", async () => {
  const f = await fixture();
  const result = run(["config", "source", "add", "evil", "--url", "https://example.com/not-github", "--apply"], f);
  assert.equal(result.status, 2);
  await assert.rejects(readFile(join(f.home, ".ai_marketplace", "codex.json")), { code: "ENOENT" });
});

test("rejects credential-bearing or non-canonical GitHub repository URLs", async () => {
  for (const url of [
    "http://github.com/org/repo",
    "https://user:secret@github.com/org/repo",
    "https://github.com/org/repo?token=secret",
    "https://github.com/org/repo#secret",
    "https://github.com/org/repo/extra"
  ]) {
    const f = await fixture();
    const result = run(["config", "source", "add", "unsafe", "--url", url, "--apply"], f);
    assert.equal(result.status, 2, url);
    assert.doesNotMatch(result.stdout + result.stderr, /user:secret|token=secret|#secret/);
    await assert.rejects(readFile(join(f.home, ".ai_marketplace", "codex.json")), { code: "ENOENT" });
  }
});

test("rejects credentials persisted in the config file", async () => {
  const f = await fixture();
  const path = join(f.home, ".ai_marketplace", "codex.json");
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify({ schemaVersion: 1, token: "must-not-load" }));
  const result = run(["config", "show"], f);
  assert.equal(result.status, 2); assert.doesNotMatch(result.stdout + result.stderr, /must-not-load/);
});

test("strict config rejects unknown and nested credential fields", async () => {
  for (const config of [
    { schemaVersion: 1, unexpected: true },
    { schemaVersion: 1, repositories: [{ id: "demo", url: "owner/repo", metadata: { apiKey: "hidden" } }] }
  ]) {
    const f = await fixture(); const path = join(f.home, ".ai_marketplace", "codex.json");
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(config));
    const result = run(["config", "show"], f);
    assert.equal(result.status, 2); assert.doesNotMatch(result.stdout + result.stderr, /hidden/);
  }
});

test("config read and lock creation reject a symlinked metadata directory", async (t) => {
  const f = await fixture(); const outside = join(f.root, "outside"); await mkdir(outside);
  try { await symlink(outside, join(f.home, ".ai_marketplace"), "dir"); } catch (error) { if (error.code === "EPERM") return t.skip("symlinks unavailable"); throw error; }
  const read = run(["config", "show"], f);
  assert.equal(read.status, 5); assert.equal(read.json.error.code, "FILESYSTEM_OR_SECURITY");
  const write = run(["config", "auto-update", "set", "true", "--apply"], f);
  assert.equal(write.status, 5); assert.equal(write.json.error.code, "FILESYSTEM_OR_SECURITY");
  await assert.rejects(readFile(join(outside, "codex.json")), { code: "ENOENT" });
});

test("active operation locks prevent mutation", async () => {
  const f = await fixture();
  const dry = run(["config", "auto-update", "set", "true"], f);
  const lock = join(f.home, ".ai_marketplace", ".operation.lock");
  await mkdir(dirname(lock), { recursive: true });
  await writeFile(lock, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
  const result = run(["config", "auto-update", "set", "true", "--apply", "--plan-id", dry.json.planId], f);
  assert.equal(result.status, 5); assert.match(result.json.error.message, /operation holds/);
});

test("stale dead-process operation locks are recovered", async () => {
  const f = await fixture();
  const dry = run(["config", "auto-update", "set", "true"], f);
  const lock = join(f.home, ".ai_marketplace", ".operation.lock");
  await mkdir(dirname(lock), { recursive: true });
  await writeFile(lock, `${JSON.stringify({ pid: 2147483647, startedAt: "2000-01-01T00:00:00.000Z" })}\n`);
  const result = run(["config", "auto-update", "set", "true", "--apply", "--plan-id", dry.json.planId], f);
  assert.equal(result.status, 0); assert.equal(result.json.applied, true);
});

test("operation lock permission errors request exact host approval without suggesting a bypass", () => {
  const detail = filesystemErrorMessage(Object.assign(new Error("EPERM: operation not permitted, open 'C:\\Users\\demo\\.ai_marketplace\\.operation.lock'"), { code: "EPERM" }));
  assert.match(detail, /Request host filesystem approval for this exact lock path/);
  assert.match(detail, /do not delete or bypass the lock/);
});

function installed(id, scope) {
  return { id, type: "skill", platform: "codex", scope, version: "1.0.0", sourceRepo: "owner/repo", sourceBranch: "main", sourcePath: `Skills/${id}`, sourceId: "default", qualifiedName: `@demo/${id}`, group: "demo", installedPath: `.codex/skills/${id}`, installedAt: "2026-08-08T00:00:00.000Z" };
}
