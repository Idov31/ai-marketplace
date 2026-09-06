import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGitHubRepo } from "../src/services/githubUrl";

describe("GitHub URL parsing", () => {
  it("extracts owner and repo from a repository URL", () => {
    assert.deepEqual(parseGitHubRepo("https://github.com/Idov31/AI-Repository"), {
      owner: "Idov31",
      repository: "AI-Repository",
      fullName: "Idov31/AI-Repository"
    });
  });

  it("accepts owner/repo values", () => {
    assert.deepEqual(parseGitHubRepo("Idov31/AI-Repository"), {
      owner: "Idov31",
      repository: "AI-Repository",
      fullName: "Idov31/AI-Repository"
    });
  });

  it("ignores non-GitHub repository values", () => {
    assert.equal(parseGitHubRepo("AI-Repository"), undefined);
    assert.equal(parseGitHubRepo("https://example.com/org/repo"), undefined);
    for (const value of [
      "http://github.com/org/repo",
      "https://user:secret@github.com/org/repo",
      "https://github.com:443/org/repo",
      "https://github.com/org/repo?token=secret",
      "https://github.com/org/repo#secret",
      "https://github.com/org/repo/extra"
    ]) assert.equal(parseGitHubRepo(value), undefined, value);
  });
});
