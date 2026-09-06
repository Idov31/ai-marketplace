import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { request as httpRequest } from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const output = fileURLToPath(new URL("../.test-build/dashboard-backend.cjs", import.meta.url));
await build({ entryPoints: [fileURLToPath(new URL("../src/dashboardBackend.ts", import.meta.url))], outfile: output, bundle: true, platform: "node", format: "cjs", target: "node22", sourcemap: false });
const { DashboardApplication, DashboardApplicationError, NodeMarketplaceStorage, getDashboardServerStatus, startDashboardServer } = createRequire(import.meta.url)(output);

test("atomic dashboard metadata writes use collision-resistant temporary paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-dashboard-write-"));
  const home = join(root, "home"); const workspace = join(root, "workspace");
  await mkdir(home); await mkdir(workspace);
  const storage = new NodeMarketplaceStorage(workspace, home);
  await Promise.all(Array.from({ length: 20 }, (_, index) => storage.writeFileAtomic("workspace", ".ai_marketplace/dashboard.json", Buffer.from(JSON.stringify({ index })))));
  const value = JSON.parse(await readFile(join(workspace, ".ai_marketplace", "dashboard.json"), "utf8"));
  assert.ok(Number.isInteger(value.index) && value.index >= 0 && value.index < 20);
});

test("dashboard application stores exact plans and rejects stale or expired apply", async () => {
  const fixture = await applicationFixture();
  const plan = await fixture.application.createPlan({ action: "install", identities: ["default:@team/demo"], scope: "workspace" });
  assert.equal(plan.items.length, 1);
  assert.deepEqual(plan.items[0].paths.map((item) => [item.scope, item.path, item.effect]), [
    ["workspace", ".codex/skills/demo", "write"],
    ["workspace", ".ai_marketplace/installed.json", "state"]
  ]);
  fixture.installed.push(installed("other"));
  await assert.rejects(fixture.application.applyPlan(plan.planId), (error) => error instanceof DashboardApplicationError && error.code === "STALE_PLAN");

  fixture.installed.length = 0;
  const expiring = await fixture.application.createPlan({ action: "install", identities: ["default:@team/demo"] });
  fixture.advance(300_001);
  await assert.rejects(fixture.application.applyPlan(expiring.planId), (error) => error instanceof DashboardApplicationError && error.code === "EXPIRED_PLAN");
});

test("dashboard application expands group, sync, and configuration changes into server plans", async () => {
  const fixture = await applicationFixture();
  const group = await fixture.application.createPlan({ action: "install-group", group: "team", scope: "global" });
  assert.equal(group.items[0].kind, "package");
  assert.equal(group.items[0].scope, "global");
  assert.ok(group.items[0].paths.every((path) => path.scope === "global"));
  const preferences = await fixture.application.createPlan({ action: "set-preferences", autoUpdate: true, autoInstallGroups: ["team"] });
  assert.equal(preferences.items[0].kind, "configuration");
  assert.equal(preferences.items[0].paths[0].path, ".ai_marketplace/codex.json");
  assert.deepEqual(preferences.items[0].changes, [{ field: "autoUpdate", before: false, after: true }]);
  const applied = await fixture.application.applyPlan(preferences.planId);
  assert.equal(applied.applied, true);
  assert.equal(fixture.configurationState.preferences.autoUpdate, true);
});

test("dashboard MCP plans disclose executable scripts and require destructive review", async () => {
  const fixture = await applicationFixture({ mcp: true });
  const plan = await fixture.application.createPlan({ action: "install", identities: ["default:@team/demo"], scope: "global" });
  assert.equal(plan.destructive, true);
  assert.deepEqual(plan.items[0].paths.filter((item) => item.effect === "execute").map((item) => item.path), [
    ".ai_marketplace/mcp-packages/codex/default/demo/install.py"
  ]);
});

test("dashboard application rejects and consumes a plan after an apply failure", async () => {
  const fixture = await applicationFixture({ failInstall: true });
  const events = [];
  fixture.application.subscribe((event) => events.push(event));
  const plan = await fixture.application.createPlan({ action: "install", identities: ["default:@team/demo"], scope: "workspace" });
  await assert.rejects(fixture.application.applyPlan(plan.planId), /simulated install failure/);
  assert.deepEqual(events.filter((event) => event.event === "operation").map((event) => event.data.status), ["applying", "rejected"]);
  await assert.rejects(fixture.application.applyPlan(plan.planId), (error) => error instanceof DashboardApplicationError && error.code === "EXPIRED_PLAN");
});

test("dashboard application consumes ineligible plans and keeps workspace sync local", async () => {
  const ineligibleFixture = await applicationFixture();
  ineligibleFixture.installed.push(installed("demo"));
  const events = [];
  ineligibleFixture.application.subscribe((event) => events.push(event));
  const ineligible = await ineligibleFixture.application.createPlan({ action: "install", identities: ["default:@team/demo"], scope: "workspace" });
  await assert.rejects(ineligibleFixture.application.applyPlan(ineligible.planId), (error) => error instanceof DashboardApplicationError && error.code === "INELIGIBLE");
  assert.deepEqual(events.filter((event) => event.event === "operation").map((event) => event.data.status), ["rejected"]);
  await assert.rejects(ineligibleFixture.application.applyPlan(ineligible.planId), (error) => error instanceof DashboardApplicationError && error.code === "EXPIRED_PLAN");

  const syncFixture = await applicationFixture({ defaultPackage: true });
  const workspace = await syncFixture.application.createPlan({ action: "sync", scope: "workspace" });
  syncFixture.advance(1);
  const global = await syncFixture.application.createPlan({ action: "sync", scope: "global" });
  syncFixture.advance(1);
  const both = await syncFixture.application.createPlan({ action: "sync" });
  assert.equal(workspace.items.length, 0);
  assert.equal(global.items.length, 1);
  assert.equal(global.items[0].scope, "global");
  assert.equal(both.items.length, 1);

  const alreadyInstalledFixture = await applicationFixture({ defaultPackage: true });
  alreadyInstalledFixture.installed.push(installed("demo", "workspace"));
  const noDuplicateGlobal = await alreadyInstalledFixture.application.createPlan({ action: "sync", scope: "global" });
  assert.equal(noDuplicateGlobal.items.length, 0);
});

test("dashboard plans and applies an explicit predecessor migration", async () => {
  const fixture = await applicationFixture({ migration: true });
  fixture.installed.push(installed("old"));
  const plan = await fixture.application.createPlan({ action: "migrate", identities: ["default:@team/new"], scope: "workspace" });
  assert.equal(plan.destructive, true);
  assert.equal(plan.items[0].action, "migrate");
  assert.equal(plan.items[0].version, "1.0.0");
  assert.equal(plan.items[0].targetVersion, "1.0.0");
  assert.deepEqual(plan.items[0].paths.map((item) => item.path), [".codex/skills/old", ".codex/skills/new", ".ai_marketplace/migration-journal.json", ".ai_marketplace/installed.json"]);
  const result = await fixture.application.applyPlan(plan.planId);
  assert.equal(result.count, 1);
  assert.equal(fixture.installed[0].id, "new");
});

test("loopback server enforces one-time bootstrap, cookie, Host, Origin, CSRF, CSP, SSE, and descriptor lifecycle", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-dashboard-"));
  const home = join(root, "home"); const workspace = join(root, "workspace");
  await mkdir(home); await mkdir(workspace);
  const storage = new NodeMarketplaceStorage(workspace, home);
  const events = new Set();
  const application = {
    subscribe(listener) { events.add(listener); return () => events.delete(listener); },
    async getModel() { return { schemaVersion: 1, rows: [] }; },
    async getDetail(identity) { return { identity }; },
    async createPlan(body) { return { schemaVersion: 1, planId: "plan", request: body }; },
    async applyPlan(planId) { return { planId, applied: true, count: 0 }; },
    async refresh() { return { schemaVersion: 1, rows: [] }; },
    async diagnose() { return { connected: true }; }
  };
  const options = { workspace, storage, application, asset: async (path) => path === "/index.html" ? { contentType: "text/html; charset=utf-8", body: '<!doctype html><script src="/app.js"></script>' } : path === "/app.js" ? { contentType: "text/javascript", body: "" } : undefined };
  let server;
  try { server = await startDashboardServer(options); } catch (error) { if (error?.code === "EPERM") return t.skip("loopback listen is unavailable in this sandbox"); throw error; }
  t.after(() => server.close().catch(() => undefined));
  assert.match(server.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(await startDashboardServer(options), server);
  const descriptorFile = join(workspace, ".ai_marketplace", "dashboard.json");
  const descriptor = JSON.parse(await readFile(descriptorFile, "utf8"));
  assert.equal(descriptor.origin, server.origin);
  if (process.platform !== "win32") assert.equal((await stat(descriptorFile)).mode & 0o777, 0o600);
  const beforeStatusUrl = descriptor.launchUrl;
  const status = await getDashboardServerStatus(storage);
  assert.equal(status.origin, server.origin);
  assert.equal(JSON.parse(await readFile(descriptorFile, "utf8")).launchUrl, beforeStatusUrl);
  const invalidControl = await fetch(`${server.origin}/api/control/status`, { headers: { "X-Dashboard-Control": "wrong" } });
  assert.equal(invalidControl.status, 403);
  const launch = new URL(descriptor.launchUrl); const token = new URLSearchParams(launch.hash.slice(1)).get("token");
  assert.ok(token);

  const page = await fetch(server.origin);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy") ?? "", /script-src 'self'/);
  assert.doesNotMatch(page.headers.get("content-security-policy") ?? "", /https:|unsafe-inline/);

  assert.equal(await requestStatus(server.origin, "/api/model", { Host: "localhost" }), 403);
  const bootstrap = await fetch(`${server.origin}/api/bootstrap`, { method: "POST", headers: { Origin: server.origin, "X-Dashboard-Token": token } });
  assert.equal(bootstrap.status, 200);
  const { csrfToken } = await bootstrap.json();
  const cookie = bootstrap.headers.get("set-cookie");
  assert.match(cookie ?? "", /HttpOnly; SameSite=Strict/);
  const reused = await fetch(`${server.origin}/api/bootstrap`, { method: "POST", headers: { Origin: server.origin, "X-Dashboard-Token": token } });
  assert.equal(reused.status, 403);
  const model = await fetch(`${server.origin}/api/model`, { headers: { Cookie: cookie } });
  assert.equal(model.status, 200);
  const missingDetailQuery = await fetch(`${server.origin}/api/packages/default/${encodeURIComponent("@team/demo")}`, { headers: { Cookie: cookie } });
  assert.equal(missingDetailQuery.status, 400);
  const duplicateDetailQuery = await fetch(`${server.origin}/api/packages/default/${encodeURIComponent("@team/demo")}?kind=available&kind=installed`, { headers: { Cookie: cookie } });
  assert.equal(duplicateDetailQuery.status, 400);
  const detail = await fetch(`${server.origin}/api/packages/default/${encodeURIComponent("@team/demo")}?kind=available`, { headers: { Cookie: cookie } });
  assert.equal(detail.status, 200);
  const noCsrf = await fetch(`${server.origin}/api/plans`, { method: "POST", headers: { Cookie: cookie, Origin: server.origin, "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
  assert.equal(noCsrf.status, 403);
  const crossOrigin = await fetch(`${server.origin}/api/plans`, { method: "POST", headers: { Cookie: cookie, Origin: "http://example.invalid", "X-CSRF-Token": csrfToken, "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
  assert.equal(crossOrigin.status, 403);
  const valid = await fetch(`${server.origin}/api/plans`, { method: "POST", headers: { Cookie: cookie, Origin: server.origin, "X-CSRF-Token": csrfToken, "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync" }) });
  assert.equal(valid.status, 200);
  const heartbeat = await fetch(`${server.origin}/api/heartbeat`, { method: "POST", headers: { Cookie: cookie, Origin: server.origin, "X-CSRF-Token": csrfToken, "Content-Type": "application/json" }, body: "{}" });
  assert.deepEqual(await heartbeat.json(), { ok: true, idleTimeoutMs: 1800000 });
  const apply = await fetch(`${server.origin}/api/plans/plan/apply`, { method: "POST", headers: { Cookie: cookie, Origin: server.origin, "X-CSRF-Token": csrfToken, "Content-Type": "application/json" }, body: "{}" });
  assert.equal(apply.status, 200);
  const sse = await fetch(`${server.origin}/api/events`, { headers: { Cookie: cookie } });
  assert.equal(sse.status, 200);
  const reader = sse.body.getReader(); const first = await reader.read();
  assert.match(Buffer.from(first.value).toString("utf8"), /event: ready/);
  await reader.cancel();
  await server.close();
  await assert.rejects(access(descriptorFile), { code: "ENOENT" });
});

test("dashboard closes after authenticated client inactivity", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-dashboard-idle-")); const home = join(root, "home"); const workspace = join(root, "workspace");
  await mkdir(home); await mkdir(workspace);
  const storage = new NodeMarketplaceStorage(workspace, home);
  const application = { subscribe: () => () => {}, async getModel() { return {}; }, async getDetail() { return {}; }, async createPlan() { return {}; }, async applyPlan() { return {}; }, async refresh() { return {}; }, async diagnose() { return {}; } };
  let server;
  try { server = await startDashboardServer({ workspace, storage, application, idleTimeoutMs: 100, idleCheckIntervalMs: 20 }); } catch (error) { if (error?.code === "EPERM") return t.skip("loopback listen is unavailable in this sandbox"); throw error; }
  t.after(() => server.close().catch(() => undefined));
  const descriptor = JSON.parse(await readFile(join(workspace, ".ai_marketplace", "dashboard.json"), "utf8"));
  const token = new URLSearchParams(new URL(descriptor.launchUrl).hash.slice(1)).get("token");
  const bootstrap = await fetch(`${server.origin}/api/bootstrap`, { method: "POST", headers: { Origin: server.origin, "X-Dashboard-Token": token } });
  assert.equal(bootstrap.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 180));
  await assert.rejects(fetch(`${server.origin}/api/model`));
  await assert.rejects(access(join(workspace, ".ai_marketplace", "dashboard.json")), { code: "ENOENT" });
});

async function applicationFixture(options = {}) {
  let now = Date.parse("2026-08-08T00:00:00.000Z");
  const installedState = [];
  const basePackage = pkg("demo", options.defaultPackage ? ["default"] : ["demo"]);
  const catalog = [options.migration
    ? { ...pkg("new"), manifest: { ...pkg("new").manifest, migrations: [{ from: { name: "@team/old" } }] } }
    : options.mcp
      ? { ...basePackage, manifest: { ...basePackage.manifest, type: "mcp", delivery: ["global"], entrypoint: "mcp.json" }, sourcePath: "Mcps/demo", manifestPath: "Mcps/demo/ai_marketplace.yaml" }
      : basePackage];
  const configurationState = { configured: true, preferences: { autoUpdate: false, autoInstallGroups: options.defaultPackage ? ["team"] : [] }, revision: "config-1" };
  const service = {
    getCatalog: () => catalog,
    listInstalled: async () => installedState,
    planGroup: async () => [{ pkg: catalog[0], platform: "codex", scope: "global" }],
    install: async (pkgValue, _platform, scope) => { if (options.failInstall) throw new Error("simulated install failure"); const value = installed(pkgValue.manifest.id, scope); installedState.push(value); return value; },
    update: async (_pkgValue, value) => value,
    migrate: async (pkgValue, value) => { const index = installedState.indexOf(value); const next = { ...value, id: pkgValue.manifest.id, qualifiedName: pkgValue.manifest.qualifiedName, installedPath: `.codex/skills/${pkgValue.manifest.id}` }; installedState.splice(index, 1, next); return next; },
    revert: async (_pkgValue, value) => value,
    uninstall: async (value) => { const index = installedState.indexOf(value); if (index >= 0) installedState.splice(index, 1); },
    hotload: async (value) => value,
    offload: async (value) => value,
    diagnose: async () => ({ connected: true })
  };
  const configuration = {
    read: async () => ({ ...configurationState, preferences: { ...configurationState.preferences } }),
    plan: async (request) => ({ identity: request.action, summary: request.action, changes: [{ field: "autoUpdate", before: false, after: request.autoUpdate ?? false }], nextValue: request }),
    apply: async (request) => { if (request.action === "set-preferences") configurationState.preferences = { autoUpdate: request.autoUpdate, autoInstallGroups: request.autoInstallGroups }; configurationState.revision = `${configurationState.revision}-next`; }
  };
  const application = new DashboardApplication({ service, marketplaceConfig: () => config(), configuration, refreshCatalog: async () => ({ packages: catalog, warnings: [] }), withOperationLock: async (_roots, action) => action(), now: () => new Date(now), planId: () => `plan-${now}` });
  return { application, installed: installedState, configurationState, advance: (ms) => { now += ms; } };
}

function config() { return { repository: "owner/repo", branch: "main", packageFolders: { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" }, platformPathOverrides: {}, defaultPlatform: "codex" }; }
function pkg(id, tags = ["demo"]) { return { manifest: { id, qualifiedName: `@team/${id}`, name: id, group: "team", type: "skill", version: "1.0.0", description: id, platforms: ["codex"], delivery: ["workspace", "global"], entrypoint: "SKILL.md", tags }, source: { id: "default", label: "Default", owner: "owner", repository: "repo", branch: "main" }, sourcePath: `Skills/${id}`, manifestPath: `Skills/${id}/ai_marketplace.yaml`, hotload: true, sourceRevision: "revision" }; }
function installed(id, scope = "workspace") { return { id, type: "skill", platform: "codex", scope, version: "1.0.0", sourceRepo: "owner/repo", sourceBranch: "main", sourcePath: `Skills/${id}`, sourceId: "default", qualifiedName: `@team/${id}`, group: "team", installedPath: `.codex/skills/${id}`, installedAt: "2026-08-08T00:00:00.000Z", sourceRevision: "revision" }; }

function requestStatus(origin, path, headers) {
  const target = new URL(origin);
  return new Promise((resolveRequest, reject) => {
    const request = httpRequest({ hostname: "127.0.0.1", port: Number(target.port), path, headers }, (response) => {
      response.resume();
      response.on("end", () => resolveRequest(response.statusCode));
    });
    request.on("error", reject);
    request.end();
  });
}
