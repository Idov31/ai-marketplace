import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GitHubClient, GitHubRequestError } from "../src/services/githubClient";
import { RepositoryClient, type RepositoryCatalogProgress } from "../src/services/repositoryClient";
import { type MarketplaceConfig, type MarketplacePackage, type RepositoryConfig } from "../src/types/packages";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GitHub client", () => {
  it("loads AI Marketplace packages and files with source provenance", async () => {
    const blobs = new Map([
      ["manifest-sha", manifestYaml()],
      ["entrypoint-sha", "---\nhotload: true\n---\n# Skill"],
      ["readme-sha", "details"]
    ]);
    globalThis.fetch = mockGitHub(blobs);

    const client = new GitHubClient(config(), undefined, () => undefined);
    const packages = await client.listMarketplacePackages();
    const files = await client.fetchPackageFiles(packages[0]);

    assert.equal(packages.length, 1);
    assert.equal(packages[0].manifest.id, "my-skill");
    assert.equal(packages[0].manifest.group, "team");
    assert.equal(packages[0].source.id, "team-a");
    assert.equal(packages[0].sourceRevision, "c".repeat(40));
    assert.equal(packages[0].hotload, true);
    assert.deepEqual(files.map((file) => file.relativePath).sort(), ["README.md", "SKILL.md", "ai_marketplace.yaml"]);
  });

  it("prefers one canonical manifest when both filenames exist", async () => {
    globalThis.fetch = mockGitHub(new Map([
      ["canonical-manifest", canonicalYaml("2.0.0")], ["manifest-sha", manifestYaml()],
      ["entrypoint-sha", "# Skill"], ["readme-sha", "details"]
    ]), true);
    const logs: string[] = [];
    const packages = await new GitHubClient(config(), undefined, (line) => logs.push(line)).listMarketplacePackages();
    assert.equal(packages.length, 1);
    assert.equal(packages[0]?.manifest.version, "2.0.0");
    assert.doesNotMatch(logs.join("\n"), /manifest compatibility summary/);
  });

  it("rejects an invalid canonical manifest", async () => {
    globalThis.fetch = mockGitHub(new Map([
      ["canonical-manifest", "schema_version: 1\n"], ["manifest-sha", manifestYaml()],
      ["entrypoint-sha", "# Skill"], ["readme-sha", "details"]
    ]), true);
    assert.deepEqual(await new GitHubClient(config(), undefined, () => undefined).listMarketplacePackages(), []);
  });

  it("keeps successful repositories when another source fails", async () => {
    const logs: string[] = [];
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.includes("/repos/example/team-b/")) {
        return textResponse("missing", 404, "Not Found");
      }
      return mockGitHub(new Map([
        ["manifest-sha", manifestYaml()],
        ["entrypoint-sha", "# Skill"],
        ["readme-sha", "details"]
      ]))(input);
    };

    const client = new GitHubClient(config([source("team-a"), source("team-b")]), undefined, (message) => logs.push(message));
    const packages = await client.listMarketplacePackages();

    assert.equal(packages.length, 1);
    assert.match(logs.join("\n"), /Unable to refresh source 'team-b'/);
  });

  it("parses repositories concurrently and publishes cumulative source snapshots", async () => {
    let releaseSlowSource = (): void => undefined;
    const slowSource = new Promise<void>((resolve) => { releaseSlowSource = resolve; });
    const mock = mockGitHub(new Map([
      ["manifest-sha", manifestYaml()],
      ["entrypoint-sha", "# Skill"],
      ["readme-sha", "details"]
    ]));
    globalThis.fetch = async (input, init) => {
      const url = requestUrl(input);
      if (url.includes("/repos/example/team-a/git/trees/main")) await slowSource;
      return mock(input, init);
    };
    const progress: RepositoryCatalogProgress[] = [];
    const client = new RepositoryClient(config([source("team-a"), source("team-b")]), {
      sharedCredentials: async () => [],
      sourceCredentials: async () => []
    }, () => undefined);

    const loading = client.listMarketplacePackages((snapshot) => { progress.push(snapshot); });
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.deepEqual(progress.map((snapshot) => snapshot.source.id), ["team-b"]);
    assert.equal(progress[0]?.catalog.length, 1);

    releaseSlowSource();
    const packages = await loading;
    assert.deepEqual(progress.map((snapshot) => snapshot.source.id), ["team-b", "team-a"]);
    assert.equal(progress[1]?.catalog.length, 2);
    assert.equal(packages.length, 2);
  });

  it("does not wait for a slow provider before publishing another provider", async () => {
    let releaseGitHub = (): void => undefined;
    const slowGitHub = new Promise<void>((resolve) => { releaseGitHub = resolve; });
    const githubMock = mockGitHub(new Map([
      ["manifest-sha", manifestYaml()],
      ["entrypoint-sha", "# Skill"],
      ["readme-sha", "details"]
    ]));
    globalThis.fetch = async (input, init) => {
      const url = new URL(requestUrl(input));
      if (url.hostname === "dev.azure.com") {
        if (url.pathname.endsWith("/refs")) return jsonResponse({ value: [{ name: "refs/heads/main", objectId: "a".repeat(40) }] });
        if (url.searchParams.has("scopePath")) return jsonResponse({ value: [] });
      }
      if (url.pathname.includes("/repos/example/team-a/git/trees/main")) await slowGitHub;
      return githubMock(input, init);
    };
    const progress: RepositoryCatalogProgress[] = [];
    const client = new RepositoryClient(config([source("team-a"), azureSource("azure-fast")]), {
      sharedCredentials: async () => [],
      sourceCredentials: async () => []
    }, () => undefined);

    const loading = client.listMarketplacePackages((snapshot) => { progress.push(snapshot); });
    await new Promise<void>((resolve) => setImmediate(resolve));

    assert.deepEqual(progress.map((snapshot) => snapshot.source.id), ["azure-fast"]);
    releaseGitHub();
    const packages = await loading;
    assert.deepEqual(progress.map((snapshot) => snapshot.source.id), ["azure-fast", "team-a"]);
    assert.equal(packages.length, 1);
  });

  it("retries 401/403 responses with the source-specific token without logging it", async () => {
    const authorizations: string[] = [];
    const logs: string[] = [];
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      authorizations.push(headers.get("authorization") ?? "");
      if (headers.get("authorization") === "Bearer shared") {
        return textResponse("forbidden", 403, "Forbidden");
      }
      return mockGitHub(new Map([
        ["manifest-sha", manifestYaml()],
        ["entrypoint-sha", "# Skill"],
        ["readme-sha", "details"]
      ]))(input, init);
    };

    const client = new GitHubClient(config(), "shared", (message) => logs.push(message), async () => "source-secret");
    const packages = await client.listMarketplacePackages();

    assert.equal(packages.length, 1);
    assert.ok(authorizations.includes("Bearer shared"));
    assert.ok(authorizations.includes("Bearer source-secret"));
    assert.doesNotMatch(logs.join("\n"), /shared|source-secret/);
  });

  it("throws request errors for failed explicit connection checks", async () => {
    globalThis.fetch = async () => textResponse("missing", 404, "Not Found");
    const client = new GitHubClient(config(), undefined, () => undefined);
    await assert.rejects(() => client.checkConnection(), GitHubRequestError);
  });

  it("rejects a tree response without an immutable revision SHA", async () => {
    globalThis.fetch = async () => jsonResponse({ tree: [] });
    const client = new GitHubClient(config(), undefined, () => undefined);
    await assert.rejects(() => client.checkConnection(), /did not return an immutable revision SHA/);
  });

  it("skips MCP packages without exact root-level lifecycle scripts", async () => {
    const logs: string[] = [];
    const manifest = [
      "schema_version: 1", "minimum_reader_schema_version: 1", "package:", "  name: '@team/my-mcp'", "  type: mcp", "  version: 1.0.0", "  description: MCP.", "  entrypoint: mcp.json",
      "targets:", "  platforms: [codex]", "  delivery: [global]", "metadata:", "  tags: [mcp]", ""
    ].join("\n");
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.includes("/git/trees/main")) return jsonResponse({ sha: "c".repeat(40), tree: [
        { path: "Mcps/my-mcp/ai_marketplace.yaml", type: "blob", sha: "mcp-manifest" },
        { path: "Mcps/my-mcp/mcp.json", type: "blob", sha: "mcp-entrypoint" },
        { path: "Mcps/my-mcp/scripts/install.py", type: "blob", sha: "nested-install" },
        { path: "Mcps/my-mcp/Uninstall.py", type: "blob", sha: "wrong-case-uninstall" }
      ] });
      const sha = url.match(/\/git\/blobs\/([^/?]+)/)?.[1];
      if (sha === "mcp-manifest") return jsonResponse({ encoding: "base64", content: Buffer.from(manifest).toString("base64") });
      if (sha === "mcp-entrypoint") return jsonResponse({ encoding: "base64", content: Buffer.from(JSON.stringify({ mcpServers: { test: { command: "test" } } })).toString("base64") });
      return textResponse("not found", 404, "Not Found");
    };

    const packages = await new GitHubClient(config(), undefined, (message) => logs.push(message)).listMarketplacePackages();

    assert.equal(packages.length, 0);
    assert.match(logs.join("\n"), /root-level 'install\.py'/);
  });

  it("loads an exact historical package snapshot", async () => {
    const revision = "a".repeat(40);
    const blobs = new Map([
      ["historical-manifest", manifestYaml("0.9.0")],
      ["historical-entrypoint", "# Historical skill"],
      ["historical-readme", "historical details"]
    ]);
    globalThis.fetch = mockHistoricalGitHub(revision, blobs);
    const current = currentPackage(revision);
    const client = new GitHubClient(config(), undefined, () => undefined);
    const snapshot = await client.fetchPackageAtRevision(current, revision);
    assert.equal(snapshot.manifest.version, "0.9.0");
    assert.equal(snapshot.sourceRevision, revision);
    assert.deepEqual((await client.fetchPackageFiles(snapshot)).map((file) => file.relativePath).sort(), ["README.md", "SKILL.md", "ai_marketplace.yaml"]);
    await assert.rejects(
      () => client.fetchPackageAtRevision({ ...current, manifest: { ...current.manifest, id: "different" } }, revision),
      /does not match the configured package source/
    );
  });

  it("rejects a rollback revision that is not an exact commit", async () => {
    const revision = "a".repeat(40);
    globalThis.fetch = mockHistoricalGitHub(revision, new Map(), "c".repeat(40));
    const client = new GitHubClient(config(), undefined, () => undefined);
    await assert.rejects(() => client.fetchPackageAtRevision(currentPackage(revision), revision), /not an exact Git commit/);
  });
});

function config(repositories: readonly RepositoryConfig[] = [source("team-a")]): MarketplaceConfig {
  return {
    repository: "example/team-a",
    branch: "main",
    packageFolders: repositories[0].packageFolders,
    repositories,
    platformPathOverrides: {},
    defaultPlatform: "codex"
  };
}

function source(id: string): RepositoryConfig {
  return {
    id,
    label: id,
    provider: "github",
    host: "github.com",
    owner: "example",
    repository: id,
    branch: "main",
    enabled: true,
    allowDefaultPackages: false,
    packageFolders: {
      skill: "Skills/",
      command: "Commands/",
      mcp: "Mcps/",
      agent: "Agents/",
      hook: "Hooks/",
      rule: "Rules/"
    }
  };
}

function azureSource(id: string): RepositoryConfig {
  return {
    id,
    label: id,
    provider: "azure-devops",
    host: "dev.azure.com",
    organization: "example",
    project: "marketplace",
    repository: id,
    branch: "main",
    enabled: true,
    allowDefaultPackages: false,
    packageFolders: source("folders").packageFolders
  };
}

function manifestYaml(version = "1.0.0"): string {
  return [
    "schema_version: 1", "minimum_reader_schema_version: 1", "package:", "  name: '@team/my-skill'", "  type: skill",
    `  version: ${version}`, "  description: Useful.", "  entrypoint: SKILL.md", "targets:", "  platforms: [codex]",
    "  delivery: [workspace, global]", "metadata:", "  tags: [test]",
    ""
  ].join("\n");
}

function currentPackage(previousVersion: string): MarketplacePackage {
  return {
    manifest: {
      id: "my-skill", qualifiedName: "@team/my-skill", name: "@team/my-skill", group: "team", type: "skill", version: "1.0.0", description: "Useful.",
      platforms: ["codex"], delivery: ["workspace", "global"], entrypoint: "SKILL.md", tags: ["test"], previousVersion
    },
    sourcePath: "Skills/my-skill", manifestPath: "Skills/my-skill/ai_marketplace.yaml", hotload: false,
    source: { id: "team-a", label: "team-a", provider: "github", host: "github.com", owner: "example", repository: "team-a", branch: "main" }
  };
}

function mockHistoricalGitHub(revision: string, blobs: ReadonlyMap<string, string>, commitSha = revision): typeof fetch {
  const treeSha = "b".repeat(40);
  return async (input: string | URL | Request) => {
    const url = requestUrl(input);
    if (url.includes(`/git/commits/${revision}`)) {
      return jsonResponse({ sha: commitSha, tree: { sha: treeSha } });
    }
    if (url.includes(`/git/trees/${treeSha}`)) {
      return jsonResponse({ sha: treeSha, tree: [
        { path: "Skills/my-skill/ai_marketplace.yaml", type: "blob", sha: "historical-manifest" },
        { path: "Skills/my-skill/SKILL.md", type: "blob", sha: "historical-entrypoint" },
        { path: "Skills/my-skill/README.md", type: "blob", sha: "historical-readme" }
      ] });
    }
    const sha = url.match(/\/git\/blobs\/([^/?]+)/)?.[1];
    if (sha && blobs.has(sha)) {
      return jsonResponse({ encoding: "base64", content: Buffer.from(blobs.get(sha) ?? "", "utf8").toString("base64") });
    }
    return textResponse("not found", 404, "Not Found");
  };
}

function mockGitHub(blobs: ReadonlyMap<string, string>, includeCanonical = false): typeof fetch {
  return async (input: string | URL | Request) => {
    const url = requestUrl(input);
    if (url.includes("/git/trees/main") || url.includes(`/git/trees/${"c".repeat(40)}`)) {
      return jsonResponse({
        sha: "c".repeat(40),
        tree: [
          ...(includeCanonical ? [{ path: "Skills/my-skill/ai_marketplace.yaml", type: "blob", sha: "canonical-manifest" }] : []),
          { path: "Skills/my-skill/ai_marketplace.yaml", type: "blob", sha: "manifest-sha" },
          { path: "Skills/my-skill/SKILL.md", type: "blob", sha: "entrypoint-sha" },
          { path: "Skills/my-skill/README.md", type: "blob", sha: "readme-sha" }
        ]
      });
    }
    const sha = url.match(/\/git\/blobs\/([^/?]+)/)?.[1];
    if (sha && blobs.has(sha)) {
      return jsonResponse({
        encoding: "base64",
        content: Buffer.from(blobs.get(sha) ?? "", "utf8").toString("base64")
      });
    }
    return textResponse("not found", 404, "Not Found");
  };
}

function canonicalYaml(version = "1.0.0"): string {
  return [
    "schema_version: 1", "minimum_reader_schema_version: 1", "package:", "  name: '@team/my-skill'", "  type: skill",
    `  version: ${version}`, "  description: Useful.", "  entrypoint: SKILL.md", "targets:", "  platforms: [codex]",
    "  delivery: [workspace, global]", "metadata:", "  tags: [test]", ""
  ].join("\n");
}

function requestUrl(input: string | URL | Request): string {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
}

function textResponse(value: string, status: number, statusText: string): Response {
  return new Response(value, { status, statusText });
}
