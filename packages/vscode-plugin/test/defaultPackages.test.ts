import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultPackageInstallPlans } from "../src/services/defaultPackages";
import { type InstalledPackage, type MarketplaceConfig, type MarketplacePackage, type Platform } from "../src/types/packages";

describe("default packages", () => {
  it("plans global install for uninstalled packages tagged default", () => {
    const plans = defaultPackageInstallPlans([pkg("default", ["claude", "codex"])], [], "codex");

    assert.equal(plans.length, 1);
    assert.equal(plans[0].pkg.manifest.id, "default-skill");
    assert.equal(plans[0].platform, "codex");
  });

  it("uses the first supported platform when the default platform is not supported", () => {
    const plans = defaultPackageInstallPlans([pkg("default", ["claude", "github-copilot"])], [], "codex");

    assert.equal(plans[0].platform, "github-copilot");
  });

  it("skips packages that are already installed anywhere or cannot be globally delivered", () => {
    const installed = [installedPackage("default-skill", "workspace", "claude")];

    assert.deepEqual(defaultPackageInstallPlans([pkg("default", ["claude"])], installed, "codex"), []);
    assert.deepEqual(defaultPackageInstallPlans([pkg("default", ["claude"], ["workspace"])], [], "codex"), []);
  });

  it("requires per-source opt-in when repository configuration is supplied", () => {
    const packageValue = pkg("default", ["codex"]);
    assert.deepEqual(defaultPackageInstallPlans([packageValue], [], "codex", config(false)), []);
    assert.equal(defaultPackageInstallPlans([packageValue], [], "codex", config(true)).length, 1);
  });

  it("uses the canonical installation flag instead of tag semantics", () => {
    const base = pkg("ordinary", ["codex"]);
    const tagged = pkg("default", ["codex"]);
    assert.equal(defaultPackageInstallPlans([{ ...base, manifest: { ...base.manifest, defaultInstall: true } }], [], "codex").length, 1);
    assert.deepEqual(defaultPackageInstallPlans([{ ...tagged, manifest: { ...tagged.manifest, defaultInstall: false } }], [], "codex"), []);
  });
});

function config(allowDefaultPackages: boolean): MarketplaceConfig {
  return {
    repository: "example/repo",
    branch: "main",
    packageFolders: { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" },
    repositories: [{
      id: "default", label: "Default", provider: "github", host: "github.com", owner: "example", repository: "repo", branch: "main", enabled: true,
      allowDefaultPackages,
      packageFolders: { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" }
    }],
    platformPathOverrides: {},
    defaultPlatform: "codex"
  };
}

function pkg(tag: string, platforms: readonly Platform[], delivery: readonly ("workspace" | "global" | "cloud")[] = ["workspace", "global"]): MarketplacePackage {
  return {
    manifest: {
      id: "default-skill",
      qualifiedName: "@team/default-skill",
      name: "@team/default-skill",
      group: "team",
      type: "skill",
      version: "1.0.0",
      description: "Installs automatically.",
      platforms,
      delivery,
      entrypoint: "SKILL.md",
      tags: [tag]
    },
    sourcePath: "/Skills/default-skill",
    manifestPath: "/Skills/default-skill/ai_marketplace.yaml",
    hotload: true,
    source: { id: "default", label: "Default", provider: "github", host: "github.com", owner: "example", repository: "repo", branch: "main" }
  };
}

function installedPackage(id: string, scope: "workspace" | "global", platform: Platform): InstalledPackage {
  return {
    id,
    type: "skill",
    platform,
    scope,
    version: "1.0.0",
    sourceRepo: "repo",
    sourceBranch: "main",
    sourcePath: "/Skills/default-skill",
    installedPath: ".claude/skills/default-skill",
    installedAt: "2026-06-04T00:00:00.000Z"
  };
}
