import assert from "node:assert/strict";
import test from "node:test";
import { autoInstallGroupPlans, collectPackageGroups, normalizeGroupList, planGroupInstall } from "../src/services/groupInstall";
import { type InstalledPackage, type MarketplacePackage, type Platform } from "../src/types/packages";

function pkg(id: string, group: string, supported: readonly Platform[] = ["codex", "claude"]): MarketplacePackage {
  return { manifest: { id, qualifiedName: `@${group.toLowerCase()}/${id}`, name: id, type: "skill", version: "1.0.0", description: id, group, platforms: supported, delivery: ["workspace", "global"], entrypoint: "SKILL.md", tags: ["skill"] }, source: { id: "default", label: "Default", provider: "github", host: "github.com", owner: "owner", repository: "repo", branch: "main" }, sourcePath: `Skills/${id}`, manifestPath: `Skills/${id}/ai_marketplace.yaml`, hotload: false };
}

function installed(item: MarketplacePackage, platform: Platform, scope: "workspace" | "global"): InstalledPackage {
  return { id: item.manifest.id, qualifiedName: item.manifest.qualifiedName, sourceId: item.source.id, type: item.manifest.type, platform, scope, version: item.manifest.version, sourceRepo: item.source.repository, sourceBranch: item.source.branch, sourcePath: item.sourcePath, installedPath: `.target/${item.manifest.id}`, installedAt: "2026-01-01T00:00:00.000Z", group: item.manifest.group };
}

test("plans remaining group installation options independently by scope", () => {
  const alpha = pkg("alpha", "Research"); const beta = pkg("beta", "Research");
  const current = [installed(alpha, "codex", "workspace")];
  const workspacePlans = planGroupInstall("Research", "workspace", [alpha, beta], current, "codex");
  assert.deepEqual(workspacePlans.map((item) => item.pkg.manifest.id), ["alpha", "beta"]);
  assert.equal(workspacePlans[0]?.platform, "claude");
  assert.deepEqual(planGroupInstall("Research", "global", [alpha, beta], current, "codex").map((item) => item.pkg.manifest.id), ["alpha", "beta"]);
});

test("automatic group planning preserves Claude as the preferred platform", () => {
  const plans = autoInstallGroupPlans([pkg("alpha", "Research")], [], ["Research"], "claude");
  assert.equal(plans.length, 1); assert.equal(plans[0]?.platform, "claude");
});

test("automatic groups skip existing source-qualified packages", () => {
  const alpha = pkg("alpha", "Research");
  assert.deepEqual(autoInstallGroupPlans([alpha], [installed(alpha, "codex", "workspace")], ["Research"], "codex"), []);
});

test("group helpers trim, deduplicate, and sort", () => {
  assert.deepEqual(normalizeGroupList([" Team ", "Research", "Team", ""]), ["Research", "Team"]);
  assert.deepEqual(collectPackageGroups([pkg("alpha", "Research")]), ["Research"]);
});
