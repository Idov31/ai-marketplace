import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverInstalledPackages, type AutoDiscoveryDirectoryEntry, type AutoDiscoveryFileSystem } from "../src/services/autoDiscovery";
import { type MarketplaceConfig, type MarketplacePackage } from "../src/types/packages";

describe("auto discovery", () => {
  it("discovers canonical manifests from active install paths", async () => {
    const fs = fakeFs().dir(".claude/skills", [{ name: "my-skill", isDirectory: true, isSymbolicLink: false }])
      .text(".claude/skills/my-skill/ai_marketplace.yaml", canonicalYaml());
    const discovered = await discoverInstalledPackages(options(fs));
    assert.equal(discovered.length, 1);
    assert.equal(discovered[0]?.platform, "claude");
  });

  it("ignores folders containing only the removed manifest filename", async () => {
    const fs = fakeFs().dir(".claude/skills", [{ name: "my-skill", isDirectory: true, isSymbolicLink: false }])
      .text(".claude/skills/my-skill/manifest.yaml", "name: '@team/my-skill'\n");
    assert.deepEqual(await discoverInstalledPackages(options(fs)), []);
  });

  it("does not discover an invalid canonical manifest even when an old file is present", async () => {
    const fs = fakeFs().dir(".claude/skills", [{ name: "my-skill", isDirectory: true, isSymbolicLink: false }])
      .text(".claude/skills/my-skill/ai_marketplace.yaml", "schema_version: 1\n")
      .text(".claude/skills/my-skill/manifest.yaml", "name: '@team/my-skill'\n");
    const logs: string[] = [];
    assert.deepEqual(await discoverInstalledPackages({ ...options(fs), log: (line) => logs.push(line) }), []);
    assert.match(logs.join("\n"), /ai_marketplace.yaml/);
  });
});

function options(fileSystem: AutoDiscoveryFileSystem) {
  return { config: config(), catalog: [catalogPackage()], existing: [], scope: "workspace" as const, fileSystem, now: () => "2026-06-07T00:00:00.000Z", log: () => undefined };
}

function config(): MarketplaceConfig {
  return { repository: "owner/repo", branch: "main", packageFolders: { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" }, platformPathOverrides: {}, defaultPlatform: "codex" };
}

function catalogPackage(): MarketplacePackage {
  return { manifest: { id: "my-skill", qualifiedName: "@team/my-skill", name: "@team/my-skill", group: "team", type: "skill", version: "1.0.0", description: "A useful skill.", platforms: ["claude"], delivery: ["workspace", "global"], entrypoint: "SKILL.md", tags: ["test"] }, sourcePath: "/Skills/my-skill", manifestPath: "/Skills/my-skill/ai_marketplace.yaml", hotload: true, source: { id: "default", label: "Default", provider: "github", host: "github.com", owner: "owner", repository: "repo", branch: "main" } };
}

function fakeFs(): AutoDiscoveryFileSystem & { dir(path: string, entries: readonly AutoDiscoveryDirectoryEntry[]): ReturnType<typeof fakeFs>; text(path: string, value: string): ReturnType<typeof fakeFs>; } {
  const directories = new Map<string, readonly AutoDiscoveryDirectoryEntry[]>();
  const texts = new Map<string, string>();
  const fileSystem = {
    dir(path: string, entries: readonly AutoDiscoveryDirectoryEntry[]) { directories.set(path, entries); return fileSystem; },
    text(path: string, value: string) { texts.set(path, value); return fileSystem; },
    async readDirectory(path: string) { return directories.get(path); },
    async readText(path: string) { const text = texts.get(path); if (text === undefined) { const error = new Error("ENOENT") as NodeJS.ErrnoException; error.code = "ENOENT"; throw error; } return text; }
  };
  return fileSystem;
}

function canonicalYaml(): string {
  return "schema_version: 1\nminimum_reader_schema_version: 1\npackage:\n  name: '@team/my-skill'\n  type: skill\n  version: 1.0.0\n  description: A useful skill.\n  entrypoint: SKILL.md\ntargets:\n  platforms: [claude]\n  delivery: [workspace, global]\nmetadata:\n  tags: [test]\n";
}
