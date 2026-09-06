import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PackageInstaller,
  planPackageMigrations,
  toSerializableMarketplaceModel,
  validateMarketplaceManifest,
  validateMigrationSourceIdentity,
  ValidationError,
  type InstalledPackage,
  type InstallScope,
  type MarketplaceConfig,
  type MarketplacePackage,
  type MarketplaceStorage,
  type PackageFile
} from "../src";

describe("migration manifest validation", () => {
  it("parses inherited rename, source move, and exact historical provenance entries", () => {
    const manifest = validateMarketplaceManifest(manifestValue({ history: { migrations: [
      { from: { name: "@team/old" } },
      { from: { source_id: "old-source" } },
      { from: { source_id: "old-source", name: "@team/old", repository: "OldRepo", branch: "main", path: "/Skills/old" } }
    ] } }), "/Skills/new/ai_marketplace.yaml").manifest;
    assert.deepEqual(manifest.migrations?.[0].from, { name: "@team/old" });
    assert.deepEqual(manifest.migrations?.[1].from, { sourceId: "old-source" });
    assert.equal(manifest.migrations?.[2].from.path, "/Skills/old");
  });

  it("rejects partial provenance, duplicates, self mappings, and traversal", () => {
    assert.throws(() => validateMarketplaceManifest(manifestValue({ history: { migrations: [{ from: { repository: "OldRepo" } }] } }), "ai_marketplace.yaml"), ValidationError);
    assert.throws(() => validateMarketplaceManifest(manifestValue({ history: { migrations: [{ from: { name: "@team/old" } }, { from: { name: "@team/old" } }] } }), "ai_marketplace.yaml"), ValidationError);
    assert.throws(() => validateMarketplaceManifest(manifestValue({ history: { migrations: [{ from: { name: "@team/new" } }] } }), "ai_marketplace.yaml"), ValidationError);
    assert.throws(() => validateMarketplaceManifest(manifestValue({ history: { migrations: [{ from: { repository: "OldRepo", branch: "main", path: "../old" } }] } }), "ai_marketplace.yaml"), ValidationError);
    const inheritedName = validateMarketplaceManifest(manifestValue({ history: { migrations: [{ from: { source_id: "new-source" } }] } }), "ai_marketplace.yaml").manifest;
    assert.throws(() => validateMigrationSourceIdentity(inheritedName, "new-source", "ai_marketplace.yaml"), ValidationError);
  });

  it("accepts historical GitHub full names and rejects unsafe repository forms", () => {
    const manifest = validateMarketplaceManifest(manifestValue({ history: { migrations: [{ from: { name: "@team/old", repository: "legacy-owner/OldRepo", branch: "main", path: "/Skills/old" } }] } }), "ai_marketplace.yaml").manifest;
    assert.equal(manifest.migrations?.[0].from.repository, "legacy-owner/OldRepo");
    for (const repository of ["/owner/repo", "owner/repo/extra", "owner/../repo", "owner\\repo"]) {
      assert.throws(() => validateMarketplaceManifest(manifestValue({ history: { migrations: [{ from: { name: "@team/old", repository, branch: "main", path: "/Skills/old" } }] } }), "ai_marketplace.yaml"), ValidationError);
    }
  });
});

describe("migration planning", () => {
  it("finds renamed and legacy predecessors and accepts equal versions", () => {
    const destination = marketplacePackage();
    const current = installedPackage();
    const legacy = { ...installedPackage("legacy-old"), scope: "global" as const, sourceId: undefined, qualifiedName: undefined, sourceRepo: "OldRepo", sourcePath: "/Skills/legacy-old" };
    const withLegacy = { ...destination, manifest: { ...destination.manifest, delivery: ["workspace", "global"] as const, migrations: [
      { from: { name: "@team/old" } },
      { from: { name: "@team/legacy-old", repository: "OldRepo", branch: "main", path: "/Skills/legacy-old" } }
    ] } };
    const plan = planPackageMigrations([withLegacy], [current, legacy]);
    assert.equal(plan.eligible.length, 2);
  });

  it("rejects older destinations and occupied destination identities", () => {
    const destination = marketplacePackage("0.9.0");
    const predecessor: InstalledPackage = { ...installedPackage(), managedConfig: { kind: "mcp", serverName: "old", serverConfig: { token: "sensitive-value" } } };
    assert.match(planPackageMigrations([destination], [predecessor]).ineligible[0].reason, /older/);
    const currentDestination = { ...installedPackage("new"), sourceId: "new-source", qualifiedName: "@team/new", version: "1.0.0" };
    assert.match(planPackageMigrations([marketplacePackage()], [predecessor, currentDestination]).ineligible[0].reason, /already installed/);
  });

  it("rejects incompatible and non-unique platform/scope mappings", () => {
    const predecessor = installedPackage();
    const wrongType = { ...marketplacePackage(), manifest: { ...marketplacePackage().manifest, type: "command" as const } };
    assert.match(planPackageMigrations([wrongType], [predecessor]).ineligible[0].reason, /type/);
    const second = { ...predecessor, id: "older", qualifiedName: "@team/older" };
    const destination = marketplacePackage();
    const claimed = { ...destination, manifest: { ...destination.manifest, migrations: [{ from: { name: "@team/old" } }, { from: { name: "@team/older" } }] } };
    assert.ok(planPackageMigrations([claimed], [predecessor, second]).ineligible.every((item) => /Multiple predecessor/.test(item.reason)));
  });

  it("exposes Migrate on both destination and predecessor cards", () => {
    const destination = marketplacePackage();
    const predecessor = installedPackage();
    const model = toSerializableMarketplaceModel({ packages: [destination], installed: [predecessor], configured: true, autoUpdateEnabled: false, defaultPlatform: "codex" });
    assert.equal(model.packages[0].primaryAction?.action, "migrate");
    assert.equal(model.installed[0].primaryAction?.action, "migrate");
    assert.equal(model.packages[0].migration?.predecessorId, "old");
    assert.equal(model.installed[0].migration?.destinationQualifiedName, "@team/new");
  });
});

describe("transactional migration", () => {
  it("replaces payload and state while preserving metadata and appending audit history", async () => {
    const storage = new MemoryStorage();
    const predecessor = installedPackage();
    storage.seed("workspace", predecessor.installedPath, "SKILL.md", "old");
    storage.state(predecessor);
    const installer = new PackageInstaller(storage, config, async () => packageFiles("new"));
    const migrated = await installer.migrateInstalled(marketplacePackage(), predecessor);
    assert.equal(storage.text("workspace", ".codex/skills/new/SKILL.md"), "new");
    assert.equal(storage.text("workspace", ".codex/skills/old/SKILL.md"), undefined);
    assert.equal(migrated.installedAt, predecessor.installedAt);
    assert.equal(migrated.migrationHistory?.[0].from.qualifiedName, "@team/old");
    assert.doesNotMatch(storage.journalWrites.join("\n"), /sensitive-value|serverConfig|managedConfig/);
    assert.equal((await installer.listInstalled())[0].qualifiedName, "@team/new");
  });

  it("restores the predecessor when the atomic state swap fails", async () => {
    const storage = new MemoryStorage();
    const predecessor = installedPackage();
    storage.seed("workspace", predecessor.installedPath, "SKILL.md", "old");
    storage.state(predecessor);
    storage.failNextStateWrite = true;
    const installer = new PackageInstaller(storage, config, async () => packageFiles("new"));
    await assert.rejects(installer.migrateInstalled(marketplacePackage(), predecessor), /state write failed/);
    assert.equal(storage.text("workspace", ".codex/skills/old/SKILL.md"), "old");
    assert.equal(storage.text("workspace", ".codex/skills/new/SKILL.md"), undefined);
  });

  it("preserves offload state while renaming the managed payload", async () => {
    const storage = new MemoryStorage();
    const predecessor = { ...installedPackage(), installedPath: ".offload/codex/skills/old", hotloaded: false };
    storage.seed("workspace", predecessor.installedPath, "SKILL.md", "old");
    storage.state(predecessor);
    const migrated = await new PackageInstaller(storage, config, async () => packageFiles("new")).migrateInstalled(marketplacePackage(), predecessor);
    assert.equal(migrated.installedPath, ".offload/codex/skills/new");
    assert.equal(storage.text("workspace", ".offload/codex/skills/new/SKILL.md"), "new");
    assert.equal(storage.text("workspace", ".codex/skills/new/SKILL.md"), undefined);
  });

  it("atomically replaces an owned Codex MCP contribution", async () => {
    const storage = new MemoryStorage();
    const predecessor: InstalledPackage = { id: "old", qualifiedName: "@team/old", sourceId: "new-source", group: "team", type: "mcp", platform: "codex", scope: "global", version: "1.0.0", sourceRepo: "OldRepo", sourceBranch: "main", sourcePath: "/Mcps/old", installedPath: ".codex/config.toml", installedAt: "2026-01-01T00:00:00.000Z", managedConfig: { kind: "mcp", serverName: "old", serverConfig: { command: "old" } }, managedPayloadPath: ".ai_marketplace/mcp-packages/codex/new-source/old" };
    storage.put("global", ".codex/config.toml", '[settings]\nvalue = "keep"\n\n[mcp_servers.old]\ncommand = "old"\n');
    storage.seed("global", predecessor.managedPayloadPath!, "uninstall.py", "# uninstall");
    storage.state(predecessor);
    const destination: MarketplacePackage = { ...marketplacePackage(), manifest: { ...marketplacePackage().manifest, id: "new", qualifiedName: "@team/new", name: "@team/new", type: "mcp", delivery: ["global"], entrypoint: "mcp.json" }, sourcePath: "/Mcps/new", manifestPath: "/Mcps/new/ai_marketplace.yaml" };
    const entrypoint = JSON.stringify({ codex: { mcp_servers: { new: { command: "new" } } } });
    const actions: string[] = [];
    const migrated = await new PackageInstaller(storage, config, async () => [
      { relativePath: "mcp.json", content: Buffer.from(entrypoint) },
      { relativePath: "install.py", content: Buffer.from("# install") },
      { relativePath: "uninstall.py", content: Buffer.from("# uninstall") }
    ], { run: async (request) => { actions.push(`${request.script}:${request.action}`); } }).migrateInstalled(destination, predecessor);
    const content = storage.text("global", ".codex/config.toml") ?? "";
    assert.match(content, /\[settings\]/);
    assert.match(content, /\[mcp_servers\.new\]/);
    assert.doesNotMatch(content, /mcp_servers\.old/);
    assert.equal(migrated.managedConfig?.kind, "mcp");
    assert.deepEqual(actions, ["uninstall.py:migrate", "install.py:migrate"]);
  });

  it("rejects a Codex MCP migration when its destination server name is already unmanaged", async () => {
    const storage = new MemoryStorage();
    const predecessor: InstalledPackage = { id: "old", qualifiedName: "@team/old", sourceId: "new-source", group: "team", type: "mcp", platform: "codex", scope: "global", version: "1.0.0", sourceRepo: "OldRepo", sourceBranch: "main", sourcePath: "/Mcps/old", installedPath: ".codex/config.toml", installedAt: "2026-01-01T00:00:00.000Z", managedConfig: { kind: "mcp", serverName: "old", serverConfig: { command: "old" } }, managedPayloadPath: ".ai_marketplace/mcp-packages/codex/new-source/old" };
    storage.put("global", ".codex/config.toml", '[mcp_servers.new]\ncommand = "manual"\n\n[mcp_servers.old]\ncommand = "old"\n');
    storage.seed("global", predecessor.managedPayloadPath!, "uninstall.py", "# uninstall");
    storage.state(predecessor);
    const destination: MarketplacePackage = { ...marketplacePackage(), manifest: { ...marketplacePackage().manifest, id: "new", qualifiedName: "@team/new", name: "@team/new", type: "mcp", delivery: ["global"], entrypoint: "mcp.json" }, sourcePath: "/Mcps/new", manifestPath: "/Mcps/new/ai_marketplace.yaml" };
    const entrypoint = JSON.stringify({ codex: { mcp_servers: { new: { command: "new" } } } });

    await assert.rejects(new PackageInstaller(storage, config, async () => [
      { relativePath: "mcp.json", content: Buffer.from(entrypoint) },
      { relativePath: "install.py", content: Buffer.from("# install") },
      { relativePath: "uninstall.py", content: Buffer.from("# uninstall") }
    ], { run: async () => undefined }).migrateInstalled(destination, predecessor), /already exists or changed outside AI Marketplace/);
    assert.match(storage.text("global", ".codex/config.toml") ?? "", /command = "manual"/);
  });

  it("rejects a tampered recovery journal without touching its requested path", async () => {
    const storage = new MemoryStorage();
    const predecessor = installedPackage();
    storage.seed("workspace", ".codex/skills/victim", "SKILL.md", "keep");
    storage.put("workspace", ".ai_marketplace/migration-journal.json", JSON.stringify({
      operationId: "00000000-0000-0000-0000-000000000000",
      previous: { id: "old", qualifiedName: "@team/old", sourceId: "new-source", sourceRepo: "OldRepo", sourceBranch: "main", sourcePath: "/Skills/old", type: "skill", platform: "codex", scope: "workspace", installedPath: predecessor.installedPath },
      next: { id: "new", sourceId: "new-source", platform: "codex", scope: "workspace" },
      targetPath: ".codex/skills/victim",
      payloadBackup: ".ai_marketplace/migrations/00000000-0000-0000-0000-000000000000/payload"
    }));
    await assert.rejects(new PackageInstaller(storage, config, async () => []).listInstalled(), /unexpected managed paths/);
    assert.equal(storage.text("workspace", ".codex/skills/victim/SKILL.md"), "keep");
  });
});

function manifestValue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { schema_version: 1, minimum_reader_schema_version: 1, package: { name: "@team/new", type: "skill", version: "1.0.0", description: "New", entrypoint: "SKILL.md" }, targets: { platforms: ["codex"], delivery: ["workspace"] }, ...overrides };
}

function marketplacePackage(version = "1.0.0"): MarketplacePackage {
  return { manifest: validateMarketplaceManifest(manifestValue({ package: { name: "@team/new", type: "skill", version, description: "New", entrypoint: "SKILL.md" }, history: { migrations: [{ from: { name: "@team/old" } }] } }), "ai_marketplace.yaml").manifest, sourcePath: "/Skills/new", manifestPath: "/Skills/new/ai_marketplace.yaml", hotload: true, source: { id: "new-source", label: "New", provider: "github", host: "github.com", owner: "org", repository: "NewRepo", branch: "main" } };
}

function installedPackage(id = "old"): InstalledPackage {
  return { id, qualifiedName: `@team/${id}`, sourceId: "new-source", group: "team", type: "skill", platform: "codex", scope: "workspace", version: "1.0.0", sourceRepo: "OldRepo", sourceBranch: "main", sourcePath: `/Skills/${id}`, installedPath: `.codex/skills/${id}`, installedAt: "2026-01-01T00:00:00.000Z", autoUpdate: false };
}

function packageFiles(content: string): readonly PackageFile[] {
  return [{ relativePath: "SKILL.md", content: Buffer.from(content) }, { relativePath: "ai_marketplace.yaml", content: Buffer.from("manifest") }];
}

class MemoryStorage implements MarketplaceStorage {
  private readonly files = new Map<string, Uint8Array>();
  public failNextStateWrite = false;
  public readonly journalWrites: string[] = [];
  public seed(scope: InstallScope, root: string, file: string, content: string): void { this.files.set(this.key(scope, `${root}/${file}`), Buffer.from(content)); }
  public state(pkg: InstalledPackage): void { this.files.set(this.key(pkg.scope, ".ai_marketplace/installed.json"), Buffer.from(JSON.stringify({ schemaVersion: 2, packages: [pkg] }))); }
  public put(scope: InstallScope, path: string, content: string): void { this.files.set(this.key(scope, path), Buffer.from(content)); }
  public text(scope: InstallScope, path: string): string | undefined { const value = this.files.get(this.key(scope, path)); return value && Buffer.from(value).toString("utf8"); }
  public async readFile(scope: InstallScope, path: string): Promise<Uint8Array | undefined> { return this.files.get(this.key(scope, path)); }
  public async exists(scope: InstallScope, path: string): Promise<boolean> { const key = this.key(scope, path); return [...this.files.keys()].some((item) => item === key || item.startsWith(`${key}/`)); }
  public async writeFile(scope: InstallScope, path: string, content: Uint8Array): Promise<void> { await this.writeFileAtomic(scope, path, content); }
  public async writeFileAtomic(scope: InstallScope, path: string, content: Uint8Array): Promise<void> {
    if (path === ".ai_marketplace/installed.json" && this.failNextStateWrite) { this.failNextStateWrite = false; throw new Error("state write failed"); }
    if (path === ".ai_marketplace/migration-journal.json") this.journalWrites.push(Buffer.from(content).toString("utf8"));
    this.files.set(this.key(scope, path), content);
  }
  public async replaceDirectory(scope: InstallScope, path: string, files: readonly PackageFile[]): Promise<void> { await this.remove(scope, path); for (const file of files) this.files.set(this.key(scope, `${path}/${file.relativePath}`), file.content); }
  public async move(scope: InstallScope, from: string, to: string): Promise<void> { const fromKey = this.key(scope, from); const matches = [...this.files.entries()].filter(([key]) => key === fromKey || key.startsWith(`${fromKey}/`)); if (matches.length === 0) throw new Error("move source missing"); for (const [key, value] of matches) { this.files.delete(key); this.files.set(this.key(scope, `${to}${key.slice(fromKey.length)}`), value); } }
  public async remove(scope: InstallScope, path: string): Promise<void> { const key = this.key(scope, path); for (const item of [...this.files.keys()]) if (item === key || item.startsWith(`${key}/`)) this.files.delete(item); }
  private key(scope: InstallScope, path: string): string { return `${scope}:${path.replace(/^\/+|\/+$/g, "")}`; }
}

const config: MarketplaceConfig = { repository: "org/NewRepo", branch: "main", packageFolders: { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" }, repositories: [], platformPathOverrides: {}, defaultPlatform: "codex" };
