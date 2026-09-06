import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eligibleInstallPlatforms, installOptionsForPackage, mcpInstallPlatformCandidates, repositoryFilterKey, toSerializableMarketplaceModel } from "../src/services/marketplaceModel";
import { type InstalledPackage, type MarketplacePackage, type Platform } from "../src/types/packages";

const pkg: MarketplacePackage = {
  manifest: {
    id: "my-skill",
    qualifiedName: "@team/my-skill",
    name: "@team/my-skill",
    group: "team",
    type: "skill",
    version: "2.0.0",
    description: "Useful",
    platforms: ["claude", "github-copilot", "codex"],
    delivery: ["workspace", "global"],
    entrypoint: "SKILL.md",
    tags: ["workflow"]
  },
  sourcePath: "/Skills/my-skill",
  manifestPath: "/Skills/my-skill/ai_marketplace.yaml",
  hotload: true,
  source: { id: "default", label: "Default", provider: "github", host: "github.com", owner: "example", repository: "repo", branch: "main" }
};

describe("marketplace model", () => {
  it("offers workspace and user-directory installs using the default platform first", () => {
    assert.deepEqual(installOptionsForPackage(pkg, [], "codex"), [
      { action: "install", scope: "workspace", platform: "codex", label: "Install" },
      { action: "installGlobal", scope: "global", platform: "codex", label: "Install in user directory" }
    ]);
  });

  it("keeps only remaining install options for installed packages", () => {
    const installed: InstalledPackage[] = [{
      id: "my-skill",
      type: "skill",
      platform: "codex",
      scope: "workspace",
      version: "2.0.0",
      sourceRepo: "repo",
      sourceBranch: "main",
      sourceId: "default",
      qualifiedName: "@team/my-skill",
      group: "team",
      sourcePath: "/Skills/my-skill",
      installedPath: ".codex/skills/my-skill",
      installedAt: "2026-06-04T00:00:00.000Z"
    }];

    assert.deepEqual(installOptionsForPackage(pkg, installed, "codex"), [
      { action: "installDifferentPlatform", scope: "workspace", platform: "github-copilot", label: "Install in workspace for different platform" },
      { action: "installGlobal", scope: "global", platform: "codex", label: "Install in user directory" }
    ]);
  });

  it("keeps partially installed packages available with their remaining install actions", () => {
    const installed: InstalledPackage[] = [installedPackage("codex", "workspace")];

    const model = toSerializableMarketplaceModel({
      packages: [pkg],
      installed,
      configured: true,
      autoUpdateEnabled: false,
      defaultPlatform: "codex"
    });

    assert.deepEqual(model.packages[0].installOptions, [
      { action: "installDifferentPlatform", scope: "workspace", platform: "github-copilot", label: "Install in workspace for different platform" },
      { action: "installGlobal", scope: "global", platform: "codex", label: "Install in user directory" }
    ]);
    assert.deepEqual(model.installed[0].installOptions, [
      { action: "installDifferentPlatform", scope: "workspace", platform: "github-copilot", label: "Install in workspace for different platform" },
      { action: "installGlobal", scope: "global", platform: "codex", label: "Install in user directory" }
    ]);
  });

  it("marks updates unavailable when versions match", () => {
    const installed = [installedPackage("codex", "workspace")];
    const model = toSerializableMarketplaceModel({
      packages: [pkg],
      installed,
      configured: true,
      autoUpdateEnabled: true,
      defaultPlatform: "codex"
    });

    assert.equal(model.installed[0].updateAvailable, false);
    assert.equal(model.autoUpdateEnabled, true);
  });

  it("keeps a rollback pin actionable as an explicit update", () => {
    const model = toSerializableMarketplaceModel({ packages: [pkg], installed: [{ ...installedPackage("codex", "workspace"), autoUpdate: false, revertedAt: "2026-07-31T00:00:00.000Z" }], configured: true, autoUpdateEnabled: true, defaultPlatform: "codex" });
    assert.equal(model.installed[0].status.kind, "reverted");
    assert.equal(model.installed[0].primaryAction?.label, "Update to latest");
  });

  it("does not offer update when only the repository revision changes", () => {
    const model = toSerializableMarketplaceModel({
      packages: [{ ...pkg, sourceRevision: "b".repeat(40) }],
      installed: [{ ...installedPackage("codex", "workspace"), sourceRevision: "a".repeat(40) }],
      configured: true,
      autoUpdateEnabled: false,
      defaultPlatform: "codex"
    });
    assert.equal(model.installed[0].updateAvailable, false);
    assert.notEqual(model.installed[0].primaryAction?.action, "update");
  });

  it("derives compact actions for available, local, offloaded, outdated, MCP, and cloud packages", () => {
    const available = toSerializableMarketplaceModel({ packages: [pkg], installed: [], configured: true, autoUpdateEnabled: false, defaultPlatform: "codex" });
    assert.equal(available.packages[0].primaryAction?.action, "install"); assert.equal(available.packages[0].moreActions[0].action, "installGlobal");
    const currentPkg = { ...pkg, manifest: { ...pkg.manifest, previousVersion: "a".repeat(40) } };
    const current = toSerializableMarketplaceModel({ packages: [currentPkg], installed: [installedPackage("codex", "workspace")], configured: true, autoUpdateEnabled: false, defaultPlatform: "codex" }).installed[0];
    assert.equal(current.primaryAction?.action, "offload"); assert.ok(current.moreActions.some((item) => item.action === "revert"));
    const offloaded = toSerializableMarketplaceModel({ packages: [currentPkg], installed: [{ ...installedPackage("codex", "workspace"), installedPath: ".offload/codex/skill/my-skill" }], configured: true, autoUpdateEnabled: false, defaultPlatform: "codex" }).installed[0];
    assert.equal(offloaded.primaryAction?.action, "hotload");
    const outdated = toSerializableMarketplaceModel({ packages: [currentPkg], installed: [{ ...installedPackage("codex", "workspace"), version: "1.0.0" }], configured: true, autoUpdateEnabled: false, defaultPlatform: "codex" }).installed[0];
    assert.equal(outdated.primaryAction?.action, "update"); assert.ok(outdated.moreActions.some((item) => item.action === "offload")); const staleRevert = outdated.moreActions.find((item) => item.action === "revert"); assert.equal(staleRevert?.disabled, true); assert.match(staleRevert?.label ?? "", /update first/);
    const mcpPkg = { ...pkg, manifest: { ...pkg.manifest, type: "mcp" as const, delivery: ["global"] as const } };
    const mcp = toSerializableMarketplaceModel({ packages: [mcpPkg], installed: [{ ...installedPackage("codex", "workspace"), type: "mcp" as const, scope: "global" as const }], configured: true, autoUpdateEnabled: false, defaultPlatform: "codex" }).installed[0];
    assert.equal(mcp.primaryAction, undefined); assert.ok(mcp.moreActions.some((item) => item.action === "uninstall"));
    const cloudPkg = { ...pkg, manifest: { ...pkg.manifest, type: "agent" as const, delivery: ["cloud"] as const } };
    const cloud = toSerializableMarketplaceModel({ packages: [cloudPkg], installed: [{ ...installedPackage("codex", "workspace"), type: "agent" as const, scope: "cloud" as const }], configured: true, autoUpdateEnabled: false, defaultPlatform: "codex" }).installed[0];
    assert.equal(cloud.primaryAction, undefined); assert.ok(cloud.moreActions.some((item) => item.action === "uninstall"));
  });

  it("offers explicit different-platform actions for workspace and user scopes", () => {
    const installed = [installedPackage("codex", "workspace"), installedPackage("codex", "global")];
    assert.deepEqual(installOptionsForPackage(pkg, installed, "codex"), [
      { action: "installDifferentPlatform", scope: "workspace", platform: "github-copilot", label: "Install in workspace for different platform" },
      { action: "installDifferentPlatform", scope: "global", platform: "github-copilot", label: "Install in user directory for different platform" }
    ]);
    const model = toSerializableMarketplaceModel({ packages: [pkg], installed, configured: true, autoUpdateEnabled: false, defaultPlatform: "codex" });
    const actions = model.installed[0].moreActions.filter((action) => action.action === "installDifferentPlatform");
    assert.deepEqual(actions.map((action) => [action.platform, action.scope]), [
      ["github-copilot", "workspace"],
      ["github-copilot", "global"]
    ]);
  });

  it("resolves eligible alternate platforms by source identity and scope", () => {
    const sameSource = installedPackage("codex", "workspace");
    const otherSource = { ...installedPackage("github-copilot", "workspace"), sourceId: "other" };

    assert.deepEqual(eligibleInstallPlatforms(pkg, [sameSource, otherSource], "workspace"), ["github-copilot", "claude"]);
    assert.deepEqual(eligibleInstallPlatforms(pkg, [sameSource, installedPackage("github-copilot", "workspace"), installedPackage("claude", "workspace")], "workspace"), []);
    assert.deepEqual(eligibleInstallPlatforms(pkg, [sameSource], "global"), ["codex", "github-copilot", "claude"]);
  });

  it("serializes stable source and legacy repository filter keys", () => {
    const model = toSerializableMarketplaceModel({ packages: [pkg], installed: [installedPackage("codex", "workspace")], configured: true, autoUpdateEnabled: false, defaultPlatform: "codex" });
    assert.equal(model.packages[0].repositoryKey, "source:default");
    assert.equal(model.installed[0].repositoryKey, "source:default");
    assert.equal(repositoryFilterKey({ sourceLabel: "Legacy", sourceRepo: "legacy-repo" }), "legacy:legacy-repo");
  });

  it("offers cloud installs for cloud-delivered agents", () => {
    const cloudAgent: MarketplacePackage = {
      manifest: {
        id: "cloud-agent",
        qualifiedName: "@team/cloud-agent",
        name: "@team/cloud-agent",
        group: "team",
        type: "agent",
        version: "1.0.0",
        description: "Runs remotely.",
        platforms: ["claude", "github-copilot", "codex"],
        delivery: ["cloud"],
        entrypoint: "agent.md",
        tags: ["agent"]
      },
      sourcePath: "/Agents/cloud-agent",
      manifestPath: "/Agents/cloud-agent/ai_marketplace.yaml",
      hotload: false,
      source: { id: "default", label: "Default", provider: "github", host: "github.com", owner: "example", repository: "repo", branch: "main" }
    };

    assert.deepEqual(installOptionsForPackage(cloudAgent, [], "codex"), [
      { action: "installCloud", scope: "cloud", platform: "codex", label: "Install to Codex cloud" }
    ]);
  });

  it("offers only user-directory installs for MCP packages", () => {
    const mcpPackage = mcpPackageForTests();
    assert.deepEqual(installOptionsForPackage(mcpPackage, [], "claude"), [
      { action: "installGlobal", scope: "global", platform: "claude", label: "Configure for Claude in user directory" }
    ]);
    assert.deepEqual(installOptionsForPackage(mcpPackage, [installedMcpPackage("claude")], "claude"), [
      { action: "installGlobal", scope: "global", platform: "codex", label: "Configure for Codex in user directory" }
    ]);
  });

  it("orders remaining MCP platform candidates", () => {
    const mcpPackage = mcpPackageForTests();
    assert.deepEqual(mcpInstallPlatformCandidates(mcpPackage, [], "github-copilot"), ["github-copilot", "codex", "claude"]);
    assert.deepEqual(mcpInstallPlatformCandidates(mcpPackage, [installedMcpPackage("github-copilot")], "github-copilot"), ["codex", "claude"]);
  });
});

function installedPackage(platform: Platform, scope: "workspace" | "global"): InstalledPackage {
  return {
    id: "my-skill",
    type: "skill",
    platform,
    scope,
    version: "2.0.0",
    sourceRepo: "repo",
    sourceBranch: "main",
    sourceId: "default",
    qualifiedName: "@team/my-skill",
    group: "team",
    sourcePath: "/Skills/my-skill",
    installedPath: platform === "claude"
      ? ".claude/skills/my-skill"
      : platform === "github-copilot"
        ? ".github/skills/my-skill"
        : ".codex/skills/my-skill",
    installedAt: "2026-06-04T00:00:00.000Z"
  };
}

function mcpPackageForTests(): MarketplacePackage {
  return {
    manifest: {
      id: "my-mcp",
      qualifiedName: "@team/my-mcp",
      name: "@team/my-mcp",
      group: "team",
      type: "mcp",
      version: "1.0.0",
      description: "Connects an MCP server.",
      platforms: ["claude", "github-copilot", "codex"],
      delivery: ["global"],
      entrypoint: ".mcp.json",
      tags: ["mcp"]
    },
    sourcePath: "/Mcps/my-mcp",
    manifestPath: "/Mcps/my-mcp/ai_marketplace.yaml",
    hotload: false,
    source: { id: "default", label: "Default", provider: "github", host: "github.com", owner: "example", repository: "repo", branch: "main" }
  };
}

function installedMcpPackage(platform: Platform): InstalledPackage {
  return {
    id: "my-mcp",
    type: "mcp",
    platform,
    scope: "global",
    version: "1.0.0",
    sourceRepo: "repo",
    sourceBranch: "main",
    sourcePath: "/Mcps/my-mcp",
    installedPath: platform === "codex" ? ".codex/config.toml" : platform === "github-copilot" ? ".copilot/mcp-config.json" : ".claude.json",
    installedAt: "2026-06-04T00:00:00.000Z"
  };
}
