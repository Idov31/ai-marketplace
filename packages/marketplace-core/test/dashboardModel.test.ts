import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDashboardDetail,
  buildDashboardModel,
  dashboardFingerprints,
  type InstalledPackage,
  type MarketplacePackage,
  type Platform
} from "../src";

describe("dashboard model", () => {
  it("projects Codex local rows with filters, preferences, facets, and offline installed state", () => {
    const input = {
      catalog: [pkg("alpha", ["codex"]), pkg("claude-only", ["claude"]), pkg("cloud", ["codex"], ["cloud"])],
      installed: [installed("alpha", "workspace"), { ...installed("claude-only", "workspace"), platform: "claude" as const }],
      configured: true,
      preferences: { autoUpdate: true, autoInstallGroups: ["team"] },
      refresh: { state: "offline" as const, warnings: ["network unavailable"] }
    };
    const model = buildDashboardModel({ ...input, query: { tab: "installed", group: "team", pageSize: 1 } });
    assert.equal(model.platform, "codex");
    assert.deepEqual(model.scopes, ["workspace", "global"]);
    assert.equal(model.rows.length, 1);
    assert.equal(model.rows[0].kind, "installed");
    assert.equal(model.refresh.state, "offline");
    assert.deepEqual(model.preferences.autoInstallGroups, ["team"]);
    assert.deepEqual(model.facets.sources.map((source) => source.id), ["default"]);
  });

  it("caps pagination and resolves detail independently of the current page", () => {
    const catalog = Array.from({ length: 125 }, (_, index) => pkg(`pkg-${index.toString().padStart(3, "0")}`, ["codex"]));
    const input = { catalog, installed: [], configured: true, preferences: { autoUpdate: false, autoInstallGroups: [] }, refresh: { state: "online" as const, warnings: [] } };
    const model = buildDashboardModel({ ...input, query: { pageSize: 999 } });
    assert.equal(model.pagination.pageSize, 100);
    assert.equal(model.rows.length, 100);
    const detail = buildDashboardDetail(input, "default:@team/pkg-124", { kind: "available" });
    assert.equal(detail?.row.id, "pkg-124");
  });

  it("filters update rows before pagination and resolves detail by kind and installed scope", () => {
    const current = pkg("current", ["codex"]);
    const updateA = { ...pkg("update-a", ["codex"]), manifest: { ...pkg("update-a", ["codex"]).manifest, version: "2.0.0" } };
    const updateB = { ...pkg("update-b", ["codex"]), manifest: { ...pkg("update-b", ["codex"]).manifest, version: "2.0.0" } };
    const input = {
      catalog: [current, updateA, updateB],
      installed: [installed("current", "workspace"), installed("update-a", "workspace"), installed("update-b", "global")],
      configured: true,
      preferences: { autoUpdate: false, autoInstallGroups: [] },
      refresh: { state: "online" as const, warnings: [] }
    };
    const updates = buildDashboardModel({ ...input, query: { tab: "updates", pageSize: 1 } });
    assert.equal(updates.pagination.totalItems, 2);
    assert.equal(updates.pagination.totalPages, 2);
    assert.equal(updates.rows.length, 1);
    assert.ok(updates.rows.every((row) => row.kind === "installed" && row.updateAvailable));

    const available = buildDashboardDetail(input, "default:@team/current", { kind: "available" });
    const workspace = buildDashboardDetail(input, "default:@team/current", { kind: "installed", scope: "workspace" });
    const global = buildDashboardDetail(input, "default:@team/current", { kind: "installed", scope: "global" });
    assert.equal(available?.row.kind, "available");
    assert.equal(workspace?.row.kind, "installed");
    assert.equal(workspace?.row.kind === "installed" ? workspace.row.scope : undefined, "workspace");
    assert.equal(global, undefined);
  });

  it("changes state and catalog fingerprints only with relevant data", () => {
    const catalog = [pkg("alpha", ["codex"])];
    const current = dashboardFingerprints(catalog, [installed("alpha", "workspace")], { autoUpdate: false, autoInstallGroups: [] });
    const stateChanged = dashboardFingerprints(catalog, [{ ...installed("alpha", "workspace"), version: "2.0.0" }], { autoUpdate: false, autoInstallGroups: [] });
    const catalogChanged = dashboardFingerprints([{ ...catalog[0], sourceRevision: "new" }], [installed("alpha", "workspace")], { autoUpdate: false, autoInstallGroups: [] });
    assert.notEqual(current.state, stateChanged.state);
    assert.equal(current.catalog, stateChanged.catalog);
    assert.notEqual(current.catalog, catalogChanged.catalog);
  });
});

function pkg(id: string, platforms: readonly Platform[], delivery: readonly ("workspace" | "global" | "cloud")[] = ["workspace", "global"]): MarketplacePackage {
  return {
    manifest: { id, qualifiedName: `@team/${id}`, name: id, group: "team", type: "skill", version: "1.0.0", description: id, platforms, delivery, entrypoint: "SKILL.md", tags: ["demo"] },
    source: { id: "default", label: "Default", provider: "github", host: "github.com", owner: "owner", repository: "repo", branch: "main" }, sourcePath: `Skills/${id}`, manifestPath: `Skills/${id}/ai_marketplace.yaml`, hotload: true, sourceRevision: "revision"
  };
}

function installed(id: string, scope: "workspace" | "global"): InstalledPackage {
  return { id, type: "skill", platform: "codex", scope, version: "1.0.0", sourceRepo: "owner/repo", sourceBranch: "main", sourcePath: `Skills/${id}`, sourceId: "default", qualifiedName: `@team/${id}`, group: "team", installedPath: `.codex/skills/${id}`, installedAt: "2026-08-08T00:00:00.000Z", sourceRevision: "revision" };
}
