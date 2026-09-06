import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardRoot = new URL("../dashboard/", import.meta.url);
const [html, script, css] = await Promise.all([
  readFile(new URL("index.html", dashboardRoot), "utf8"),
  readFile(new URL("app.js", dashboardRoot), "utf8"),
  readFile(new URL("styles.css", dashboardRoot), "utf8")
]);

test("dashboard bootstraps the fragment secret, removes it, and protects every POST", () => {
  assert.match(script, /new URLSearchParams\(window\.location\.hash\.slice\(1\)\)/);
  assert.match(script, /fragment\.get\("token"\)/);
  assert.match(script, /fetch\("\/api\/bootstrap"/);
  assert.match(script, /"X-Dashboard-Token": dashboardToken/);
  assert.match(script, /typeof data\.csrfToken !== "string"/);
  assert.match(script, /state\.csrfToken = data\.csrfToken/);
  assert.match(script, /window\.history\.replaceState\(null, "", `\$\{window\.location\.pathname\}\$\{window\.location\.search\}`\)/);
  assert.match(script, /if \(method !== "GET"\)/);
  assert.match(script, /headers\["X-CSRF-Token"\] = state\.csrfToken/);
  assert.match(script, /api\("\/api\/heartbeat", \{ method: "POST", body: \{\} \}\)/);
  assert.match(script, /60_000/);
  assert.match(script, /document\.visibilityState !== "hidden"/);
  assert.doesNotMatch(script, /console\.(?:log|debug|info|warn|error)/);
});

test("markup has a strict self-only CSP and no executable inline content", () => {
  assert.match(html, /Content-Security-Policy/);
  for (const directive of [
    "default-src 'self'", "connect-src 'self'", "style-src 'self'", "script-src 'self'",
    "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"
  ]) assert.ok(html.includes(directive), `missing CSP directive ${directive}`);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
  assert.doesNotMatch(script, /\beval\s*\(|new Function\s*\(/);
  assert.doesNotMatch(html, /<(?:script|link|img)[^>]+(?:src|href)="https?:\/\//i);
});

test("dashboard listens only to the frozen SSE event names", () => {
  assert.match(script, /\["ready", "catalog", "state", "operation", "heartbeat"\]/);
  for (const status of ["applying", "applied", "rejected"]) assert.ok(script.includes(`"${status}"`));
  assert.doesNotMatch(script, /\["progress", "state", "refresh", "result", "warning"\]/);
});

test("dashboard is accessible and excludes unsupported platform and credential UI", () => {
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-atomic="true"/);
  assert.match(html, /<dialog id="plan-dialog"[^>]*aria-labelledby=/);
  assert.match(html, /<nav class="tabs" role="tablist" aria-label=/);
  for (const tab of ["available", "installed", "updates"]) {
    assert.match(html, new RegExp(`id="${tab}-tab"[^>]+aria-controls="marketplace-panel"`));
  }
  assert.match(html, /<main id="marketplace-panel" role="tabpanel" aria-labelledby="available-tab"/);
  assert.match(script, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/);
  assert.match(script, /event\.preventDefault\(\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);

  assert.doesNotMatch(html, /GitHub Copilot|Claude|VSIX|cloud delivery/i);
  assert.doesNotMatch(html, /<input[^>]+(?:id|name)="[^"]*token/i);
  assert.doesNotMatch(html, /type="password"/i);
});
