import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { InstalledStateStore, MarketplaceService, type InstallScope, type MarketplaceConfig, type MarketplaceStorage, type PackageFile } from "../src";

class MemoryStorage implements MarketplaceStorage {
  public readonly files = new Map<string, Uint8Array>();
  public atomicWrites = 0;
  public async readFile(scope: InstallScope, relativePath: string) { return this.files.get(`${scope}:${relativePath}`); }
  public async exists(scope: InstallScope, relativePath: string) { return this.files.has(`${scope}:${relativePath}`); }
  public async writeFile(scope: InstallScope, relativePath: string, content: Uint8Array) { this.files.set(`${scope}:${relativePath}`, content); }
  public async writeFileAtomic(scope: InstallScope, relativePath: string, content: Uint8Array) { this.atomicWrites += 1; await this.writeFile(scope, relativePath, content); }
  public async replaceDirectory(_scope: InstallScope, _relativePath: string, _files: readonly PackageFile[]) {}
  public async move() {}
  public async remove() {}
}

describe("core host boundary", () => {
  it("contains no VS Code, UI, or direct filesystem imports", async () => {
    const root = path.resolve(__dirname, "../../src");
    for (const name of await sourceFiles(root)) {
      const source = await readFile(name, "utf8");
      assert.doesNotMatch(source, /from ["'](?:vscode|node:fs|fs)["']/);
      assert.doesNotMatch(source, /marketplaceWebview|codex-plugin/);
    }
  });

  it("removes legacy workspace automation preferences", async () => {
    const storage = new MemoryStorage();
    const store = new InstalledStateStore(storage, "workspace");
    await storage.writeFile("workspace", ".ai_marketplace/installed.json", Buffer.from(JSON.stringify({ schemaVersion: 2, packages: [], autoUpdateEnabled: true, autoInstallGroups: ["team"] })));
    assert.equal(await store.discardLegacyAutomationPreferences(), true);
    assert.deepEqual(await store.read(), { schemaVersion: 2, packages: [] });
    assert.equal(storage.atomicWrites, 1);
  });

  it("projects host configuration preferences into the marketplace model", async () => {
    const storage = new MemoryStorage();
    const service = new MarketplaceService({
      storage,
      configuration: { read: () => ({ ...config(), autoUpdateEnabled: true, autoInstallGroups: ["team"] }) },
      credentials: { sharedCredentials: async () => [], sourceCredentials: async () => [] },
      logger: { log: () => undefined }
    });
    const model = await service.getMarketplaceModel();
    assert.equal(model.autoUpdateEnabled, true);
    assert.deepEqual(model.autoInstallGroups, ["team"]);
  });
});

function config(): MarketplaceConfig {
  return {
    repository: "owner/repo",
    branch: "main",
    packageFolders: { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" },
    platformPathOverrides: {},
    defaultPlatform: "codex",
  };
}

async function sourceFiles(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(path.join(root, entry.name)) : [path.join(root, entry.name)]));
  return nested.flat().filter((name) => name.endsWith(".ts"));
}
