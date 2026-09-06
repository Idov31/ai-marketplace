import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const output = join(await mkdtemp(join(tmpdir(), "ai-marketplace-credentials-")), "credentials.cjs");
await build({ stdin: { contents: 'export * from "./credentials.js"; export { toMarketplaceConfig } from "./config.js";', resolveDir: fileURLToPath(new URL("../src", import.meta.url)), sourcefile: "credential-test-entry.ts", loader: "ts" }, outfile: output, bundle: true, platform: "node", format: "cjs", target: "node22" });
const { createEnvironmentCredentialProvider, credentialSourceSummary, redactCredentials, toMarketplaceConfig } = createRequire(import.meta.url)(output);

const policy = { platform: "codex", displayName: "Codex", configFileName: "codex.json", mcpConfigRelativePath: ".codex/config.toml", supportedScopes: ["workspace", "global"] };

test("environment credentials preserve provider schemes and precedence", async () => {
  const env = { AZURE_DEVOPS_ACCESS_TOKEN: "entra", AZURE_DEVOPS_EXT_PAT: "pat", GITLAB_OAUTH_TOKEN: "oauth", GITLAB_TOKEN: "glpat", AI_MARKETPLACE_GITLAB_TOKEN_TEAM_A: "source" };
  const provider = createEnvironmentCredentialProvider(env);
  assert.deepEqual(await provider.sharedCredentials("azure-devops"), [
    { kind: "bearer", token: "entra", source: "AZURE_DEVOPS_ACCESS_TOKEN" },
    { kind: "basic-pat", token: "pat", source: "AZURE_DEVOPS_EXT_PAT" }
  ]);
  const source = toMarketplaceConfig({ schemaVersion: 1, repositories: [{ id: "team-a", provider: "gitlab", url: "https://gitlab.internal/group/repo" }] }, policy).repositories[0];
  assert.deepEqual(await provider.sourceCredentials(source), [{ kind: "private-token", token: "source", source: "AI_MARKETPLACE_GITLAB_TOKEN_TEAM_A" }]);
  assert.match(credentialSourceSummary(env, [source]), /GITLAB_OAUTH_TOKEN/);
});

test("credential redaction removes active and recognizable provider tokens", () => {
  const env = { GITLAB_TOKEN: "plain-secret" };
  const output = redactCredentials("plain-secret glpat_example azdopat_example Authorization: Bearer abc", env);
  assert.doesNotMatch(output, /plain-secret|glpat_example|azdopat_example|Bearer abc/);
});

test("configuration rejects source ids that collide in environment suffixes", () => {
  assert.throws(() => toMarketplaceConfig({ schemaVersion: 1, repositories: [
    { id: "team-a", url: "org/one" }, { id: "team_a", url: "org/two" }
  ] }, policy), /collide in credential environment variable names/);
});
