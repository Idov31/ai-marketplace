import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { availableBulkInstallScopes, availableBulkUninstallScopes, matchingUninstallTargets, planBulkInstall, planBulkUninstall } from "../src/services/bulkPlanning";
import { type InstalledPackage } from "../src/types/packages";

const workspaceAndGlobal = [
  { action: "install" as const, scope: "workspace" as const, platform: "codex" as const, label: "Install" },
  { action: "installGlobal" as const, scope: "global" as const, platform: "codex" as const, label: "Install in user directory" }
];

describe("bulk action planning", () => {
  it("plans user-directory installs and skips packages without a global target", () => {
    const candidates = [
      { selection: { packageId: "both", sourceId: "default", qualifiedName: "@team/both" }, options: workspaceAndGlobal },
      { selection: { packageId: "workspace-only", sourceId: "default", qualifiedName: "@team/workspace-only" }, options: [workspaceAndGlobal[0]] }
    ];
    assert.deepEqual(availableBulkInstallScopes(candidates), ["workspace", "global"]);
    const plan = planBulkInstall(candidates, "global");
    assert.equal(plan.eligible.length, 1);
    assert.equal(plan.eligible[0].option.action, "installGlobal");
    assert.deepEqual(plan.skipped.map((item) => item.packageId), ["workspace-only"]);
  });

  it("resolves bulk uninstall to the selected platform and chosen scope", () => {
    const installed = [installedPackage("workspace"), installedPackage("global"), { ...installedPackage("global"), platform: "claude" as const }];
    const selection = { packageId: "my-skill", sourceId: "default", qualifiedName: "@team/my-skill", platform: "codex" as const };
    assert.deepEqual(availableBulkUninstallScopes([{ selection, installed }]), ["workspace", "global"]);
    const plan = planBulkUninstall([{ selection, installed }, { selection, installed }], "global");
    assert.equal(plan.eligible.length, 1);
    assert.equal(plan.eligible[0].platform, "codex");
    assert.equal(plan.eligible[0].scope, "global");
    assert.deepEqual(plan.skipped, []);
  });

  it("keeps cloud targets available and reports missing chosen scopes as skipped", () => {
    const cloud = { ...installedPackage("workspace"), scope: "cloud" as const };
    const selection = { packageId: "my-skill", sourceId: "default", qualifiedName: "@team/my-skill", platform: "codex" as const };
    assert.deepEqual(availableBulkUninstallScopes([{ selection, installed: [cloud] }]), ["cloud"]);
    assert.equal(matchingUninstallTargets([cloud], selection)[0].scope, "cloud");
    assert.deepEqual(planBulkUninstall([{ selection, installed: [cloud] }], "global").skipped, [selection]);
  });
});

function installedPackage(scope: "workspace" | "global"): InstalledPackage {
  return {
    id: "my-skill", type: "skill", platform: "codex", scope, version: "1.0.0",
    sourceRepo: "repo", sourceBranch: "main", sourcePath: "/Skills/my-skill",
    sourceId: "default", qualifiedName: "@team/my-skill", installedPath: ".codex/skills/my-skill",
    installedAt: "2026-08-02T00:00:00.000Z"
  };
}
