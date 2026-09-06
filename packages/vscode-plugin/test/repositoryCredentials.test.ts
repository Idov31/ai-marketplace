import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createVscodeCredentialProvider, decodeRepositoryCredential, encodeRepositoryCredential, storeRepositoryCredential } from "../src/services/repositoryCredentials";

describe("VS Code repository credentials", () => {
  it("round trips typed credentials and ignores malformed values", () => {
    assert.deepEqual(decodeRepositoryCredential(encodeRepositoryCredential({ kind: "private-token", token: "secret" })), { kind: "private-token", token: "secret" });
    assert.equal(decodeRepositoryCredential("not-json"), undefined);
    assert.equal(decodeRepositoryCredential(JSON.stringify({ kind: "unknown", token: "secret" })), undefined);
  });

  it("uses typed secrets and preserves legacy GitHub and Azure DevOps credentials as fallbacks", async () => {
    const values = new Map<string, string>([
      ["githubToken", "legacy"], ["githubToken.team", "legacy-source"],
      ["azureDevOpsPat", "legacy-azure"], ["azureDevOpsPat.team", "legacy-azure-source"]
    ]);
    const secrets = { get: async (key: string) => values.get(key), store: async (key: string, value: string) => { values.set(key, value); } };
    const provider = createVscodeCredentialProvider(secrets);
    assert.deepEqual(await provider.sharedCredentials("github"), [{ kind: "bearer", token: "legacy" }]);
    const source = { id: "team", label: "Team", provider: "github" as const, host: "github.com" as const, owner: "org", repository: "repo", branch: "main", enabled: true, allowDefaultPackages: false, packageFolders: {} as never };
    assert.deepEqual(await provider.sourceCredentials(source), [{ kind: "bearer", token: "legacy-source" }]);
    await storeRepositoryCredential(secrets, "github", { kind: "bearer", token: "typed" });
    assert.deepEqual(await provider.sharedCredentials("github"), [{ kind: "bearer", token: "typed" }, { kind: "bearer", token: "legacy" }]);
    assert.deepEqual(await provider.sharedCredentials("azure-devops"), [{ kind: "basic-pat", token: "legacy-azure" }]);
    const azureSource = { ...source, provider: "azure-devops" as const, host: "dev.azure.com" as const, organization: "org", project: "project" };
    assert.deepEqual(await provider.sourceCredentials(azureSource), [{ kind: "basic-pat", token: "legacy-azure-source" }]);
  });
});
