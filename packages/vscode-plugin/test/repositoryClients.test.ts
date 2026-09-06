import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AzureDevOpsClient, GitLabClient, type CredentialProvider, type MarketplaceConfig, type RepositoryConfig } from "@ai-marketplace/core";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("Azure DevOps client", () => {
  it("loads a package at an immutable revision using PAT Basic authentication", async () => {
    const authorizations: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      authorizations.push(new Headers(init?.headers).get("authorization") ?? "");
      if (url.pathname.endsWith("/refs")) return json({ value: [{ name: "refs/heads/main", objectId: revision }] });
      if (url.pathname.includes("/commits/")) return json({ commitId: revision });
      const historical = url.searchParams.get("versionDescriptor.versionType") === "commit";
      if (url.searchParams.has("scopePath")) return json({ value: [
        { path: historical ? "/Skills/demo/ai_marketplace.yaml" : "/Skills/demo/ai_marketplace.yaml", gitObjectType: "blob" },
        { path: "/Skills/demo/SKILL.md", gitObjectType: "blob" }
      ] });
      if (url.searchParams.get("path") === "/Skills/demo/ai_marketplace.yaml") return new Response(canonicalManifest(historical ? "0.9.0" : "1.0.0"));
      if (url.searchParams.get("path") === "/Skills/demo/SKILL.md") return new Response("# Demo");
      return new Response("missing", { status: 404 });
    };
    const client = new AzureDevOpsClient(config(azureSource()), credentials({ kind: "basic-pat", token: "pat" }), () => undefined);
    const packages = await client.listMarketplacePackages();
    assert.equal(packages[0]?.source.provider, "azure-devops");
    assert.equal(packages[0]?.sourceRevision, revision);
    const snapshot = await client.fetchPackageAtRevision(packages[0]!, revision.toUpperCase());
    assert.equal(snapshot.sourceRevision, revision);
    assert.equal(snapshot.manifest.version, "0.9.0");
    assert.match(snapshot.manifestPath, /ai_marketplace\.yaml$/);
    await assert.rejects(client.fetchPackageAtRevision(packages[0]!, "main"), /full 40 character hexadecimal Git revision/);
    assert.ok(authorizations.every((value) => value === `Basic ${Buffer.from(":pat").toString("base64")}`));
  });

  it("accepts Entra OAuth bearer credentials", async () => {
    let authorization = "";
    globalThis.fetch = async (_input, init) => { authorization = new Headers(init?.headers).get("authorization") ?? ""; return json({ value: [{ name: "refs/heads/main", objectId: revision }] }); };
    await new AzureDevOpsClient(config(azureSource()), credentials({ kind: "bearer", token: "entra" }), () => undefined).checkConnection();
    assert.equal(authorization, "Bearer entra");
  });

  it("retries Azure DevOps HTML sign-in responses with the source credential", async () => {
    const authorizations: string[] = [];
    const logs: string[] = [];
    globalThis.fetch = async (_input, init) => {
      const authorization = new Headers(init?.headers).get("authorization") ?? "";
      authorizations.push(authorization);
      if (authorization === "Bearer shared") return new Response("<!DOCTYPE html><title>Sign in</title>", { status: 203, headers: { "content-type": "text/html" } });
      return json({ value: [{ name: "refs/heads/main", objectId: revision }] });
    };
    const source = azureSource();
    const provider: CredentialProvider = {
      sharedCredentials: async () => [{ kind: "bearer", token: "shared" }],
      sourceCredentials: async () => [{ kind: "basic-pat", token: "source-pat" }]
    };
    const client = new AzureDevOpsClient(config(source), provider, (line) => logs.push(line));
    await client.checkConnection();
    await client.checkConnection();
    assert.deepEqual(authorizations, [
      "Bearer shared", `Basic ${Buffer.from(":source-pat").toString("base64")}`,
      "Bearer shared", `Basic ${Buffer.from(":source-pat").toString("base64")}`
    ]);
    assert.equal(logs.filter((line) => line.includes("repository-specific credential")).length, 1);
  });

  it("reports Azure DevOps sign-in HTML as an authentication error", async () => {
    globalThis.fetch = async () => new Response("<!DOCTYPE html><title>Sign in</title>", { status: 203, headers: { "content-type": "text/html" } });
    await assert.rejects(
      new AzureDevOpsClient(config(azureSource()), credentials(), () => undefined).checkConnection(),
      /Authentication was rejected or redirected/
    );
  });
});

describe("GitLab client", () => {
  it("follows tree pagination and retries with a source access token", async () => {
    const logs: string[] = [];
    const headers: string[] = [];
    let historical = false;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      const requestHeaders = new Headers(init?.headers);
      headers.push(`${requestHeaders.get("authorization") ?? ""}|${requestHeaders.get("private-token") ?? ""}`);
      if (requestHeaders.get("authorization") === "Bearer shared") return new Response("unauthorized", { status: 401, statusText: "Unauthorized" });
      if (url.pathname.includes("/repository/commits/")) {
        if (decodeURIComponent(url.pathname).endsWith(`/${revision}`)) historical = true;
        return json({ id: revision });
      }
      if (url.pathname.endsWith("/repository/tree") && !url.searchParams.has("page_token")) {
        return json([{ id: historical ? "legacy-manifest" : "manifest", path: historical ? "Skills/demo/ai_marketplace.yaml" : "Skills/demo/ai_marketplace.yaml", type: "blob" }], { Link: `<${url.toString()}&page_token=next>; rel="next"` });
      }
      if (url.pathname.endsWith("/repository/tree")) return json([{ id: "entry", path: "Skills/demo/SKILL.md", type: "blob" }]);
      if (url.pathname.endsWith("/repository/blobs/manifest")) return blob(canonicalManifest());
      if (url.pathname.endsWith("/repository/blobs/legacy-manifest")) return blob(canonicalManifest("0.9.0"));
      if (url.pathname.endsWith("/repository/blobs/entry")) return blob("# Demo");
      return new Response("missing", { status: 404 });
    };
    const source = gitlabSource();
    const provider: CredentialProvider = {
      sharedCredentials: async () => [{ kind: "bearer", token: "shared" }],
      sourceCredentials: async () => [{ kind: "private-token", token: "source-secret" }]
    };
    const packages = await new GitLabClient(config(source), provider, (line) => logs.push(line)).listMarketplacePackages();
    assert.equal(packages[0]?.source.provider, "gitlab");
    assert.equal(packages[0]?.sourceRevision, revision);
    const snapshot = await new GitLabClient(config(source), provider, () => undefined).fetchPackageAtRevision(packages[0]!, revision.toUpperCase());
    assert.equal(snapshot.sourceRevision, revision);
    assert.equal(snapshot.manifest.version, "0.9.0");
    assert.match(snapshot.manifestPath, /ai_marketplace\.yaml$/);
    assert.ok(headers.includes("Bearer shared|"));
    assert.ok(headers.includes("|source-secret"));
    assert.match(logs.join("\n"), /repository-specific credential/);
    assert.doesNotMatch(logs.join("\n"), /shared|source-secret/);
  });

  it("rejects unsafe cross-host pagination links", async () => {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.includes("/repository/commits/")) return json({ id: revision });
      return json([], { Link: `<https://evil.example/api/v4/projects/x/repository/tree>; rel="next"` });
    };
    const logs: string[] = [];
    const packages = await new GitLabClient(config(gitlabSource()), credentials(), (line) => logs.push(line)).listMarketplacePackages();
    assert.deepEqual(packages, []);
    assert.match(logs.join("\n"), /unsafe pagination URL/);
  });
});

const revision = "0123456789abcdef0123456789abcdef01234567";
const folders = { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" } as const;

function config(source: RepositoryConfig): MarketplaceConfig {
  return { repository: "example/repo", branch: "main", packageFolders: folders, repositories: [source], platformPathOverrides: {}, defaultPlatform: "codex" };
}
function azureSource(): RepositoryConfig { return { id: "azure", label: "Azure", provider: "azure-devops", host: "dev.azure.com", organization: "acme", project: "research", repository: "packages", branch: "main", enabled: true, allowDefaultPackages: false, packageFolders: folders }; }
function gitlabSource(): RepositoryConfig { return { id: "gitlab", label: "GitLab", provider: "gitlab", host: "gitlab.example.com", namespace: "group/sub", repository: "packages", branch: "main", enabled: true, allowDefaultPackages: false, packageFolders: folders }; }
function credentials(credential?: { readonly kind: "bearer" | "basic-pat" | "private-token"; readonly token: string }): CredentialProvider { return { sharedCredentials: async () => credential ? [credential] : [], sourceCredentials: async () => [] }; }
function canonicalManifest(version = "1.0.0"): string { return ["schema_version: 1", "minimum_reader_schema_version: 1", "package:", "  name: '@team/demo'", "  type: skill", `  version: ${version}`, "  description: Demo", "  entrypoint: SKILL.md", "targets:", "  platforms: [codex]", "  delivery: [workspace]", "metadata:", "  tags: [demo]", ""].join("\n"); }
function json(value: unknown, headers?: HeadersInit): Response { return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json", ...headers } }); }
function blob(value: string): Response { return json({ encoding: "base64", content: Buffer.from(value).toString("base64") }); }
