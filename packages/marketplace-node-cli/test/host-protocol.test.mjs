import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const output = join(await mkdtemp(join(tmpdir(), "ai-marketplace-host-protocol-")), "host-protocol.cjs");
await build({ entryPoints: [fileURLToPath(new URL("../src/hostProtocol.ts", import.meta.url))], outfile: output, bundle: true, platform: "node", format: "cjs", target: "node22" });
const { HostProtocolConnection, SecretRedactor, createHostCredentialProvider, maximumHostFrameBytes, validateInitializeRequest } = createRequire(import.meta.url)(output);

function frame(message) {
  const body = Buffer.from(JSON.stringify(message));
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]);
}

function reader(stream) {
  let buffer = Buffer.alloc(0);
  stream.pause();
  return async () => {
    while (true) {
      const boundary = buffer.indexOf("\r\n\r\n");
      if (boundary >= 0) {
        const size = Number(/^Content-Length: (\d+)$/i.exec(buffer.subarray(0, boundary).toString())[1]);
        if (buffer.length >= boundary + 4 + size) {
          const value = JSON.parse(buffer.subarray(boundary + 4, boundary + 4 + size).toString());
          buffer = buffer.subarray(boundary + 4 + size);
          return value;
        }
      }
      const available = stream.read();
      if (available) buffer = Buffer.concat([buffer, available]);
      else await new Promise((resolve) => stream.once("readable", resolve));
    }
  };
}

test("protocol requires initialize and returns a versioned response", async () => {
  const input = new PassThrough(); const output = new PassThrough(); const next = reader(output);
  const connection = new HostProtocolConnection(input, output, async (method, params) => method === "initialize" ? validateInitializeRequest(params) : { ok: true });
  connection.start();
  input.write(frame({ protocolVersion: 1, type: "request", id: "1", method: "initialize", params: { protocolVersion: 1, runtimeVersion: "1.0.1", host: "test", hostVersion: "1", extensionVersion: "1.0.1", userRoot: "C:\\Users\\test", platform: "claude", capabilities: ["credentials"] } }));
  const response = await next();
  assert.equal(response.type, "response");
  assert.equal(response.result.platform, "claude");
});

test("credential callbacks are allowlisted, typed, and exactly redacted", async () => {
  const input = new PassThrough(); const output = new PassThrough(); const next = reader(output); const redactor = new SecretRedactor();
  const connection = new HostProtocolConnection(input, output, async (method, params) => method === "initialize" ? validateInitializeRequest(params) : undefined);
  connection.start();
  input.write(frame({ protocolVersion: 1, type: "request", id: "init", method: "initialize", params: { protocolVersion: 1, runtimeVersion: "1.0.1", host: "test", hostVersion: "1", extensionVersion: "1.0.1", userRoot: "C:\\Users\\test", platform: "codex", capabilities: ["credentials"] } }));
  await next();
  const promise = createHostCredentialProvider(connection, redactor).sharedCredentials("github");
  const callback = await next();
  assert.equal(callback.method, "credentials.get");
  input.write(frame({ protocolVersion: 1, type: "response", id: callback.id, result: [{ kind: "bearer", token: "opaque-secret-value" }] }));
  const credentials = await promise;
  assert.equal(credentials[0].source, "visual-studio-secure-store");
  assert.equal(redactor.redact("failure opaque-secret-value"), "failure [REDACTED]");
});

test("oversized or malformed frames fail closed", async () => {
  const input = new PassThrough(); const output = new PassThrough(); const diagnostics = [];
  const connection = new HostProtocolConnection(input, output, async () => ({}), (message) => diagnostics.push(message));
  connection.start();
  input.write(`Content-Length: ${maximumHostFrameBytes + 1}\r\n\r\n`);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(diagnostics[0], /frame length is invalid/);
  await assert.rejects(connection.callback("credentials.get", {}), /not initialized|closed/);
});

test("cancelled callbacks ignore late responses without closing the channel", async () => {
  const input = new PassThrough(); const output = new PassThrough(); const next = reader(output);
  const connection = new HostProtocolConnection(input, output, async (method, params) => method === "initialize" ? validateInitializeRequest(params) : {});
  connection.start();
  input.write(frame({ protocolVersion: 1, type: "request", id: "init", method: "initialize", params: { protocolVersion: 1, runtimeVersion: "1.0.1", host: "test", hostVersion: "1", extensionVersion: "1.0.1", userRoot: "C:\\Users\\test", platform: "codex", capabilities: [] } }));
  await next();
  const abort = new AbortController(); const cancelled = connection.callback("configuration.get", {}, { signal: abort.signal });
  const first = await next(); abort.abort(); await assert.rejects(cancelled, /cancelled/);
  input.write(frame({ protocolVersion: 1, type: "response", id: first.id, result: { late: true } }));
  const active = connection.callback("configuration.get", {}); const second = await next();
  input.write(frame({ protocolVersion: 1, type: "response", id: second.id, result: { ok: true } }));
  assert.deepEqual(await active, { ok: true });
});

test("sanitizes arbitrary registered secrets from protocol results and errors", async () => {
  const input = new PassThrough(); const output = new PassThrough(); const next = reader(output); const redactor = new SecretRedactor();
  redactor.register("plain-opaque-token");
  const connection = new HostProtocolConnection(input, output, async (method, params) => {
    if (method === "initialize") return validateInitializeRequest(params);
    throw new Error("remote echoed plain-opaque-token");
  }, () => {}, (value) => redactor.redact(value));
  connection.start();
  input.write(frame({ protocolVersion: 1, type: "request", id: "init", method: "initialize", params: { protocolVersion: 1, runtimeVersion: "1.0.1", host: "test", hostVersion: "1", extensionVersion: "1.0.1", userRoot: "C:\\Users\\test", platform: "codex", capabilities: [] } }));
  await next();
  input.write(frame({ protocolVersion: 1, type: "request", id: "bad", method: "diagnose", params: {} }));
  const response = await next();
  assert.doesNotMatch(JSON.stringify(response), /plain-opaque-token/);
  assert.match(response.error.message, /\[REDACTED\]/);
});

test("inbound cancellation emits no late response and preserves later requests", async () => {
  const input = new PassThrough(); const output = new PassThrough(); const next = reader(output); let release;
  const connection = new HostProtocolConnection(input, output, async (method, params) => {
    if (method === "initialize") return validateInitializeRequest(params);
    if (method === "slow") { await new Promise((resolve) => { release = resolve; }); return { late: true }; }
    return { ok: true };
  });
  connection.start();
  input.write(frame({ protocolVersion: 1, type: "request", id: "init", method: "initialize", params: { protocolVersion: 1, runtimeVersion: "1.0.2", host: "test", hostVersion: "1", extensionVersion: "1.0.2", userRoot: "C:\\Users\\test", platform: "codex", capabilities: [] } }));
  await next();
  input.write(frame({ protocolVersion: 1, type: "request", id: "slow-1", method: "slow", params: {} }));
  await new Promise((resolve) => setImmediate(resolve));
  input.write(frame({ protocolVersion: 1, type: "notification", method: "cancel", params: { id: "slow-1" } }));
  release();
  input.write(frame({ protocolVersion: 1, type: "request", id: "later", method: "status", params: {} }));
  const response = await next();
  assert.equal(response.id, "later");
  assert.deepEqual(response.result, { ok: true });
});

test("rejects credentials shorter than the exact-redaction floor", async () => {
  const input = new PassThrough(); const output = new PassThrough(); const next = reader(output); const redactor = new SecretRedactor();
  const connection = new HostProtocolConnection(input, output, async (method, params) => method === "initialize" ? validateInitializeRequest(params) : {});
  connection.start();
  input.write(frame({ protocolVersion: 1, type: "request", id: "init", method: "initialize", params: { protocolVersion: 1, runtimeVersion: "1.0.2", host: "test", hostVersion: "1", extensionVersion: "1.0.2", userRoot: "C:\\Users\\test", platform: "codex", capabilities: ["credentials"] } }));
  await next();
  const promise = createHostCredentialProvider(connection, redactor).sharedCredentials("github");
  const callback = await next();
  input.write(frame({ protocolVersion: 1, type: "response", id: callback.id, result: [{ kind: "bearer", token: "abc" }] }));
  await assert.rejects(promise, /invalid/);
});
