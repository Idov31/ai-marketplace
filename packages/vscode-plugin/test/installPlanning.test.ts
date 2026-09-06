import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { uninstallTargetPaths } from "../src/services/installPlanning";
import { type InstalledPackage, type MarketplaceConfig } from "../src/types/packages";

const config: MarketplaceConfig = {
  repository: "Idov31/AI-Repository",
  branch: "main",
  packageFolders: {
    skill: "Skills/",
    command: "Commands/",
    mcp: "Mcps/",
    agent: "Agents/",
    hook: "Hooks/",
    rule: "Rules/"
  },
  platformPathOverrides: {},
  defaultPlatform: "codex"
};

describe("install planning", () => {
  it("uninstall removes both active and offload paths for an offloaded package", () => {
    const installed: InstalledPackage = {
      id: "my-skill",
      type: "skill",
      platform: "claude",
      scope: "workspace",
      version: "1.0.0",
      sourceRepo: "repo",
      sourceBranch: "main",
      sourcePath: "/Skills/my-skill",
      installedPath: ".offload/claude/skills/my-skill",
      installedAt: "2026-05-28T00:00:00.000Z",
      hotloaded: false
    };

    assert.deepEqual(uninstallTargetPaths(installed, config), [
      ".offload/claude/skills/my-skill",
      ".claude/skills/my-skill"
    ]);
  });

  it("uninstall removes both active and offload paths for a hotloaded package", () => {
    const installed: InstalledPackage = {
      id: "my-skill",
      type: "skill",
      platform: "claude",
      scope: "workspace",
      version: "1.0.0",
      sourceRepo: "repo",
      sourceBranch: "main",
      sourcePath: "/Skills/my-skill",
      installedPath: ".claude/skills/my-skill",
      installedAt: "2026-05-28T00:00:00.000Z",
      hotloaded: true
    };

    assert.deepEqual(uninstallTargetPaths(installed, config), [
      ".claude/skills/my-skill",
      ".offload/claude/skills/my-skill"
    ]);
  });

  it("uninstall includes an explicitly tracked Codex agent discovery file", () => {
    const installed: InstalledPackage = {
      id: "triage",
      type: "agent",
      platform: "codex",
      scope: "workspace",
      version: "1.0.0",
      sourceRepo: "repo",
      sourceBranch: "main",
      sourcePath: "/Agents/triage",
      managedConfig: { kind: "codex-agent", configPath: ".codex/agents/triage.toml", contentSha256: "a".repeat(64) },
      installedPath: ".codex/agents/triage",
      installedAt: "2026-05-28T00:00:00.000Z"
    };

    assert.deepEqual(uninstallTargetPaths(installed, config), [
      ".codex/agents/triage",
      ".codex/agents/triage.toml",
      ".offload/codex/agents/triage"
    ]);
  });
});
