import assert from "node:assert/strict";
import { access, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sidecar = fileURLToPath(new URL("../bin/ai-marketplace.cjs", import.meta.url));

function frame(message) {
  const body = Buffer.from(JSON.stringify(message));
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]);
}

function frameReader(stream) {
  let buffer = Buffer.alloc(0); const queue = []; const waiters = [];
  stream.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const boundary = buffer.indexOf("\r\n\r\n");
      if (boundary < 0) break;
      const match = /^Content-Length: (\d+)$/i.exec(buffer.subarray(0, boundary).toString("ascii"));
      if (!match) throw new Error("Invalid frame in sidecar output.");
      const size = Number(match[1]);
      if (buffer.length < boundary + 4 + size) break;
      const value = JSON.parse(buffer.subarray(boundary + 4, boundary + 4 + size).toString("utf8"));
      buffer = buffer.subarray(boundary + 4 + size);
      const waiter = waiters.shift(); if (waiter) waiter(value); else queue.push(value);
    }
  });
  return () => queue.length ? Promise.resolve(queue.shift()) : new Promise((resolve) => waiters.push(resolve));
}

test("Visual Studio sidecar handshakes over framed stdio without persisting bootstrap secrets", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-vs-sidecar-"));
  const workspace = join(root, "workspace"); const userRoot = join(root, "user");
  await mkdir(workspace); await mkdir(userRoot);
  const child = spawn(process.execPath, [sidecar, "__host-sidecar"], { stdio: ["pipe", "pipe", "pipe"], env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, TEMP: process.env.TEMP, TMP: process.env.TMP } });
  t.after(() => { if (!child.killed) child.kill(); });
  const next = frameReader(child.stdout);
  child.stdin.write(frame({ protocolVersion: 1, type: "request", id: "init", method: "initialize", params: { protocolVersion: 1, runtimeVersion: "1.1.0", host: "visualstudio", hostVersion: "17.14.37", extensionVersion: "1.1.0", workspaceRoot: workspace, userRoot, platform: "codex", capabilities: ["credentials", "configuration", "notifications", "external-links"] } }));
  let initialized;
  while (!initialized) {
    const message = await next();
    if (message.type === "request" && message.method === "configuration.get") child.stdin.write(frame({ protocolVersion: 1, type: "response", id: message.id, result: { config: { schemaVersion: 1 } } }));
    else if (message.type === "request" && message.method === "credentials.get") child.stdin.write(frame({ protocolVersion: 1, type: "response", id: message.id, result: [] }));
    else if (message.type === "response" && message.id === "init") initialized = message.result;
  }
  assert.equal(initialized.protocolVersion, 1);
  assert.equal(initialized.platform, "codex");
  assert.match(initialized.launchUrl, /^http:\/\/127\.0\.0\.1:\d+\/#token=/);
  await assert.rejects(access(join(workspace, ".ai_marketplace", "dashboard.json")), { code: "ENOENT" });
  child.stdin.write(frame({ protocolVersion: 1, type: "request", id: "stop", method: "shutdown", params: {} }));
  while (true) {
    const message = await next();
    if (message.type === "response" && message.id === "stop") { assert.equal(message.result.stopped, true); break; }
    if (message.type === "request" && message.method === "credentials.get") child.stdin.write(frame({ protocolVersion: 1, type: "response", id: message.id, result: [] }));
  }
});

test("Visual Studio sidecar rejects a runtime version mismatch", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-vs-mismatch-"));
  const child = spawn(process.execPath, [sidecar, "__host-sidecar"], { stdio: ["pipe", "pipe", "pipe"], env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, TEMP: process.env.TEMP, TMP: process.env.TMP } });
  t.after(() => { if (!child.killed) child.kill(); });
  const next = frameReader(child.stdout);
  child.stdin.write(frame({ protocolVersion: 1, type: "request", id: "init", method: "initialize", params: { protocolVersion: 1, runtimeVersion: "9.9.9", host: "visualstudio", hostVersion: "17.14", extensionVersion: "1.1.0", userRoot: root, platform: "codex", capabilities: [] } }));
  const response = await next();
  assert.equal(response.id, "init");
  assert.equal(response.error.code, "REQUEST_FAILED");
  assert.match(response.error.message, /incompatible/);
});

test("Visual Studio sidecar exits and closes the dashboard when the host pipe is lost", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-vs-pipe-loss-"));
  const workspace = join(root, "workspace"); const userRoot = join(root, "user");
  await mkdir(workspace); await mkdir(userRoot);
  const child = spawn(process.execPath, [sidecar, "__host-sidecar"], { stdio: ["pipe", "pipe", "pipe"], env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, TEMP: process.env.TEMP, TMP: process.env.TMP } });
  t.after(() => { if (!child.killed) child.kill(); });
  const next = frameReader(child.stdout);
  child.stdin.write(frame({ protocolVersion: 1, type: "request", id: "init", method: "initialize", params: { protocolVersion: 1, runtimeVersion: "1.1.0", host: "visualstudio", hostVersion: "17.14", extensionVersion: "1.1.0", workspaceRoot: workspace, userRoot, platform: "codex", capabilities: ["credentials", "configuration"] } }));
  let initialized;
  while (!initialized) {
    const message = await next();
    if (message.type === "request" && message.method === "configuration.get") child.stdin.write(frame({ protocolVersion: 1, type: "response", id: message.id, result: { config: { schemaVersion: 1 } } }));
    else if (message.type === "request" && message.method === "credentials.get") child.stdin.write(frame({ protocolVersion: 1, type: "response", id: message.id, result: [] }));
    else if (message.type === "response" && message.id === "init") initialized = message.result;
  }
  child.stdin.end();
  await Promise.race([once(child, "exit"), new Promise((_, reject) => setTimeout(() => reject(new Error("sidecar did not exit after pipe loss")), 3000))]);
  await assert.rejects(fetch(initialized.origin));
});
