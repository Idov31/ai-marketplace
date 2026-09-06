import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloudInstallPath, installRelativePath, installRootRelativePath, legacyStateRelativePath, offloadRelativePath, offloadRootRelativePath, repoJoin, safeJoinRelative, stateRelativePath, PathSafetyError } from "../src/services/pathPlanning";

describe("path planning", () => {
  it("creates default install and offload paths", () => {
    assert.equal(installRelativePath("cursor", "skill", "my-skill", {}), ".cursor/skills/my-skill");
    assert.equal(installRootRelativePath("cursor", "rule", {}), ".cursor/rules");
    assert.equal(installRelativePath("claude", "skill", "my-skill", {}), ".claude/skills/my-skill");
    assert.equal(installRootRelativePath("claude", "skill", {}), ".claude/skills");
    assert.equal(installRelativePath("codex", "command", "run-it", {}), ".codex/commands/run-it");
    assert.equal(installRelativePath("github-copilot", "skill", "my-skill", {}), ".github/skills/my-skill");
    assert.equal(installRootRelativePath("github-copilot", "rule", {}), ".github/rules");
    assert.equal(installRelativePath("codex", "hook", "prompt-guard", {}), ".codex/hooks/prompt-guard");
    assert.equal(installRelativePath("claude", "rule", "react-style", {}), ".claude/rules/react-style.md");
    assert.equal(installRelativePath("codex", "rule", "safe-gh", {}), ".codex/rules/safe-gh");
    assert.equal(installRelativePath("claude", "agent", "triage", {}), ".claude/agents/triage.md");
    assert.equal(cloudInstallPath("claude", "agent", "triage"), "cloud/claude/agents/triage");
    assert.equal(cloudInstallPath("github-copilot", "agent", "triage"), "cloud/github-copilot/agents/triage");
    assert.equal(offloadRelativePath("claude", "mcp", "server"), ".offload/claude/mcps/server");
    assert.equal(offloadRootRelativePath("claude", "mcp"), ".offload/claude/mcps");
    assert.equal(offloadRelativePath("codex", "hook", "prompt-guard"), ".offload/codex/hooks/prompt-guard");
    assert.equal(offloadRelativePath("github-copilot", "skill", "my-skill"), ".offload/github-copilot/skills/my-skill");
    assert.equal(offloadRelativePath("cursor", "agent", "triage"), ".offload/cursor/agents/triage");
    assert.equal(offloadRelativePath("claude", "rule", "react-style"), ".offload/claude/rules/react-style");
  });

  it("supports safe platform overrides", () => {
    assert.equal(
      installRelativePath("claude", "skill", "my-skill", { claude: { skill: ".custom/claude-skills" } }),
      ".custom/claude-skills/my-skill"
    );
  });

  it("rejects unsafe relative paths", () => {
    assert.throws(() => safeJoinRelative("..", "secret"), PathSafetyError);
    assert.throws(() => safeJoinRelative(".claude", "../secret"), PathSafetyError);
    assert.throws(() => safeJoinRelative(""), PathSafetyError);
  });

  it("normalizes repository paths", () => {
    assert.equal(repoJoin("Skills/", "my-skill", "package.json"), "/Skills/my-skill/package.json");
    assert.equal(repoJoin("/Skills/Cloud/xdr-alerts-cr", "SKILL.md"), "/Skills/Cloud/xdr-alerts-cr/SKILL.md");
    assert.equal(repoJoin("/"), "/");
    assert.throws(() => repoJoin("/Skills", "../secret"), PathSafetyError);
  });

  it("uses underscore marketplace metadata path and preserves legacy read path", () => {
    assert.equal(stateRelativePath(), ".ai_marketplace/installed.json");
    assert.equal(legacyStateRelativePath(), ".ai-marketplace/installed.json");
  });
});
