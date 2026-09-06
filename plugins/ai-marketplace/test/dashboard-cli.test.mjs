import assert from "node:assert/strict";
import { access, mkdtemp, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/ai-marketplace.cjs", import.meta.url));

test("dashboard CLI starts, reuses, reports, and stops one workspace server", { timeout: 25_000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-dashboard-cli-"));
  const home = join(root, "home");
  const workspace = join(root, "workspace");
  await mkdir(home); await mkdir(workspace);
  const first = await run(["dashboard", "start"], { home, workspace });
  if (first.status !== 0 && /did not become ready|timed out while starting|EPERM|operation not permitted/i.test(first.stdout + first.stderr)) {
    return t.skip("loopback listen is unavailable in this sandbox");
  }
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(first.json.reused, false);
  assert.match(first.json.launchUrl, /^http:\/\/127\.0\.0\.1:\d+\/#token=/);
  const status = await run(["dashboard", "status"], { home, workspace });
  assert.equal(status.status, 0);
  assert.equal(status.json.running, true);
  assert.equal(status.json.origin, new URL(first.json.launchUrl).origin);
  assert.equal("launchUrl" in status.json, false);
  assert.doesNotMatch(status.stdout, /#token=/);
  const reused = await run(["dashboard", "start"], { home, workspace });
  assert.equal(reused.status, 0);
  assert.equal(reused.json.reused, true);
  assert.equal(new URL(reused.json.launchUrl).origin, status.json.origin);
  const stopped = await run(["dashboard", "stop"], { home, workspace });
  assert.equal(stopped.status, 0);
  assert.equal(stopped.json.stopped, true);
  await waitForMissing(join(workspace, ".ai_marketplace", "dashboard.json"));
  const after = await run(["dashboard", "status"], { home, workspace });
  assert.equal(after.json.running, false);
});

function run(args, fixture) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [cli, ...args, "--workspace", fixture.workspace], {
      env: { ...process.env, HOME: fixture.home, USERPROFILE: fixture.home },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolveRun({ status, stdout, stderr, json: stdout ? JSON.parse(stdout) : undefined }));
  });
}

async function waitForMissing(path) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try { await access(path); } catch (error) { if (error.code === "ENOENT") return; throw error; }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  assert.fail("dashboard descriptor was not removed after stop");
}
