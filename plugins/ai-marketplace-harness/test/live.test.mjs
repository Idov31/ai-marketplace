import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { it } from "node:test";

it("serves an authenticated native Marketplace model in a pinned Harness profile", { skip: !process.env.DSH_TEST_BIN }, async () => {
  const child = spawn(process.execPath, [process.env.DSH_TEST_BIN, "--profile", "web-test", "--no-open", "--port", "0"], {
    env: process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  try {
    const startup = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("Harness startup timed out.")), 60_000);
      child.stdout.on("data", (chunk) => {
        output += chunk.toString("utf8");
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/);
        if (match) { clearTimeout(timer); resolve(match[0]); }
      });
      child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Harness exited during startup (${code}).`)); });
      child.once("error", reject);
    });
    const entry = new URL(startup);
    const auth = await fetch(entry, { redirect: "manual" });
    assert.equal(auth.status, 303);
    const cookie = auth.headers.get("set-cookie")?.split(";", 1)[0];
    assert.ok(cookie);
    const api = await fetch(new URL("/ai-marketplace/api", entry), {
      method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ action: "model", profile: "web-test" })
    });
    const result = await api.json();
    assert.equal(api.status, 200, JSON.stringify(result));
    assert.equal(result.profile, "web-test");
    assert.ok(Array.isArray(result.model.installed));
  } finally {
    child.kill();
  }
});
