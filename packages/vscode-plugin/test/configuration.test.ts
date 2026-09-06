import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeDefaultPlatform } from "../src/services/configurationValues";
import { normalizeAutoInstallGroups, normalizePackageFolders, normalizeRepositories, readUserAutomationPreferences, repositoryOverrideTargets, selectExplicitRepositorySetting } from "../src/services/configuration";

describe("configuration", () => {
  it("defaults invalid default platform values to codex", () => {
    assert.equal(normalizeDefaultPlatform(undefined), "codex");
    assert.equal(normalizeDefaultPlatform("unknown"), "codex");
  });

  it("accepts supported default platforms", () => {
    assert.equal(normalizeDefaultPlatform("codex"), "codex");
    assert.equal(normalizeDefaultPlatform("cursor"), "cursor");
    assert.equal(normalizeDefaultPlatform("github-copilot"), "github-copilot");
    assert.equal(normalizeDefaultPlatform("claude"), "claude");
  });

  it("normalizes user-wide automatic groups", () => {
    assert.deepEqual(normalizeAutoInstallGroups([" team ", "alpha", "team"]), ["alpha", "team"]);
    assert.deepEqual(normalizeAutoInstallGroups("team"), []);
    const values: Record<string, unknown> = { autoUpdate: true, autoInstallGroups: [" team ", "alpha", "team"] };
    assert.deepEqual(readUserAutomationPreferences({ get: (key: string) => values[key] } as never), {
      autoUpdateEnabled: true,
      autoInstallGroups: ["alpha", "team"]
    });
  });

});

describe("multi-repository configuration", () => {
  const folders = normalizePackageFolders(undefined);

  it("normalizes GitHub sources and per-source package folders", () => {
    const repositories = normalizeRepositories([
      {
        id: "team-a",
        label: "Team A",
        url: "https://github.com/example/team-a.git",
        branch: "release",
        allowDefaultPackages: true,
        packageFolders: { mcp: "MCPs" }
      }
    ], folders);

    assert.equal(repositories[0].provider, "github");
    if (repositories[0].provider !== "github") assert.fail("Expected GitHub repository");
    assert.equal(repositories[0].owner, "example");
    assert.equal(repositories[0].repository, "team-a");
    assert.equal(repositories[0].branch, "release");
    assert.equal(repositories[0].allowDefaultPackages, true);
    assert.equal(repositories[0].packageFolders.mcp, "MCPs/");
  });

  it("accepts an explicit empty list and rejects duplicate or unsafe repositories", () => {
    assert.deepEqual(normalizeRepositories([], folders), []);
    assert.equal(normalizeRepositories([{ id: "at-branch", url: "a/b", branch: "release@candidate" }], folders)[0].branch, "release@candidate");
    assert.throws(() => normalizeRepositories([
      { id: "same", url: "a/b" },
      { id: "same", url: "c/d" }
    ], folders));
    assert.throws(() => normalizeRepositories([{ id: "../bad", url: "a/b" }], folders));
    assert.throws(() => normalizeRepositories([{ id: "bad-host", url: "https://example.com/a/b" }], folders));
    assert.throws(() => normalizeRepositories([{ id: "bad-branch", url: "a/b", branch: "../main" }], folders));
    assert.throws(() => normalizeRepositories([{ id: "reflog-branch", url: "a/b", branch: "release@{1}" }], folders));
    assert.throws(() => normalizeRepositories([{ id: "bad-folder", url: "a/b", packageFolders: { skill: "../Skills" } }], folders));
    assert.throws(() => normalizeRepositories([{ id: "drive-folder", url: "a/b", packageFolders: { skill: "C:/Skills" } }], folders));
  });

  it("distinguishes unset repositories and applies configuration precedence", () => {
    assert.equal(selectExplicitRepositorySetting(undefined), undefined);
    assert.equal(selectExplicitRepositorySetting({ globalValue: undefined }), undefined);
    assert.deepEqual(selectExplicitRepositorySetting({ globalValue: [] }), []);
    assert.deepEqual(selectExplicitRepositorySetting({ globalValue: ["global"], workspaceValue: ["workspace"], workspaceFolderValue: ["folder"] }), ["folder"]);
    assert.deepEqual(repositoryOverrideTargets({ workspaceValue: [], workspaceFolderValue: [] }), ["workspaceFolder", "workspace"]);
    assert.deepEqual(repositoryOverrideTargets({}), []);
  });

  it("normalizes Azure DevOps, GitLab.com, and explicit self-managed GitLab sources", () => {
    const repositories = normalizeRepositories([
      { id: "azure", url: "https://dev.azure.com/acme/research/_git/packages" },
      { id: "gitlab", url: "https://gitlab.com/group/sub/packages" },
      { id: "private", provider: "gitlab", url: "https://gitlab.internal:8443/group/packages" }
    ], folders);
    assert.equal(repositories[0].provider, "azure-devops");
    assert.equal(repositories[1].provider, "gitlab");
    assert.equal(repositories[2].provider, "gitlab");
    if (repositories[2].provider === "gitlab") assert.equal(repositories[2].host, "gitlab.internal:8443");
  });
});
