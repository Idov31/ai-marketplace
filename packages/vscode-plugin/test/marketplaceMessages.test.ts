import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEditableRepository } from "../src/ui/marketplaceMessages";

const folders = { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" };

describe("marketplace configuration messages", () => {
  it("accepts a complete repository draft", () => {
    assert.deepEqual(parseEditableRepository({
      id: "team", label: "Team", url: "https://github.com/example/team", provider: "",
      branch: "main", enabled: true, allowDefaultPackages: false, packageFolders: folders
    }), {
      id: "team", label: "Team", url: "https://github.com/example/team", provider: "",
      branch: "main", enabled: true, allowDefaultPackages: false, packageFolders: folders
    });
  });

  it("rejects incomplete and mistyped repository drafts", () => {
    assert.equal(parseEditableRepository({}), undefined);
    assert.equal(parseEditableRepository({ id: "team", label: "Team", url: "a/b", provider: "unknown", branch: "main", enabled: true, allowDefaultPackages: false, packageFolders: folders }), undefined);
    assert.equal(parseEditableRepository({ id: "team", label: "Team", url: "a/b", provider: "github", branch: "main", enabled: "yes", allowDefaultPackages: false, packageFolders: folders }), undefined);
    assert.equal(parseEditableRepository({ id: "team", label: "Team", url: "a/b", provider: "github", branch: "main", enabled: true, allowDefaultPackages: false, packageFolders: { skill: "Skills/" } }), undefined);
  });
});
