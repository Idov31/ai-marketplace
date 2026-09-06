import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizedSourceCredentialId, parseRepositoryUrl, repositoryIdentity } from "@ai-marketplace/core";

describe("repository URL parsing", () => {
  it("infers Azure DevOps and GitLab.com repositories", () => {
    assert.deepEqual(parseRepositoryUrl("https://dev.azure.com/acme/Research%20Tools/_git/packages"), {
      provider: "azure-devops", host: "dev.azure.com", organization: "acme", project: "Research Tools", repository: "packages"
    });
    assert.deepEqual(parseRepositoryUrl("https://gitlab.com/group/subgroup/packages.git"), {
      provider: "gitlab", host: "gitlab.com", namespace: "group/subgroup", repository: "packages"
    });
  });

  it("supports explicit self-managed GitLab with a custom port", () => {
    const parsed = parseRepositoryUrl("https://gitlab.internal.example:8443/group/packages", "gitlab");
    assert.deepEqual(parsed, { provider: "gitlab", host: "gitlab.internal.example:8443", namespace: "group", repository: "packages" });
  });

  it("rejects unsafe URLs and provider conflicts", () => {
    for (const value of [
      "http://gitlab.com/group/repo",
      "https://user:secret@gitlab.com/group/repo",
      "https://gitlab.com/group/repo?private_token=secret",
      "https://gitlab.com/group/%2E%2E/repo",
      "https://gitlab.com/group%2Fother/repo"
    ]) assert.equal(parseRepositoryUrl(value, "gitlab"), undefined, value);
    assert.equal(parseRepositoryUrl("https://github.com/org/repo", "gitlab"), undefined);
    assert.equal(parseRepositoryUrl("https://self-managed.example/group/repo"), undefined);
  });

  it("formats provider-neutral identities and credential suffixes", () => {
    const source = { id: "gitlab", label: "GitLab", provider: "gitlab" as const, host: "gitlab.com", namespace: "group/sub", repository: "repo", branch: "main" };
    assert.equal(repositoryIdentity(source), "group/sub/repo");
    assert.equal(normalizedSourceCredentialId("team-a.prod"), "TEAM_A_PROD");
  });
});
