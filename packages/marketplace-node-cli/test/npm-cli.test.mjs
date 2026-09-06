import assert from "node:assert/strict";
import { test } from "node:test";
import { win32, posix } from "node:path";
import { npmCliCandidates, resolveNpmCli } from "../../../scripts/npm-cli.mjs";

test("prefers npm_execpath supplied by npm run", () => {
  const expected = "C:\\npm\\npm-cli.js";
  const resolved = resolveNpmCli({
    execPath: "C:\\node\\node.exe",
    npmExecPath: expected,
    exists: (candidate) => candidate === expected,
  });
  assert.equal(resolved, expected);
});

test("includes the Windows adjacent npm installation layout", () => {
  const candidates = npmCliCandidates("C:\\Program Files\\nodejs\\node.exe", undefined);
  assert.ok(candidates.includes(win32.join("C:\\Program Files\\nodejs", "node_modules", "npm", "bin", "npm-cli.js")));
});

test("includes the setup-node POSIX npm installation layout", () => {
  const execPath = "/opt/hostedtoolcache/node/24.0.0/x64/bin/node";
  const candidates = npmCliCandidates(execPath, undefined);
  assert.ok(candidates.includes(posix.join("/opt/hostedtoolcache/node/24.0.0/x64", "lib", "node_modules", "npm", "bin", "npm-cli.js")));
});
