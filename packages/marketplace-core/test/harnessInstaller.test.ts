import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PackageInstaller, type HarnessProfileManager, type InstallScope, type MarketplaceConfig, type MarketplacePackage, type MarketplaceStorage, type PackageFile } from "../src";

class MemoryStorage implements MarketplaceStorage {
  public readonly files = new Map<string, Uint8Array>();
  public async readFile(scope: InstallScope, path: string) { return this.files.get(`${scope}:${path}`); }
  public async exists(scope: InstallScope, path: string) { return [...this.files.keys()].some((key) => key === `${scope}:${path}` || key.startsWith(`${scope}:${path}/`)); }
  public async writeFile(scope: InstallScope, path: string, content: Uint8Array) { this.files.set(`${scope}:${path}`, content); }
  public async writeFileAtomic(scope: InstallScope, path: string, content: Uint8Array) { await this.writeFile(scope, path, content); }
  public async replaceDirectory(scope: InstallScope, path: string, files: readonly PackageFile[]) {
    await this.remove(scope, path);
    for (const file of files) this.files.set(`${scope}:${path}/${file.relativePath}`, file.content);
  }
  public async move(scope: InstallScope, from: string, to: string) {
    const prefix = `${scope}:${from}`;
    const matches = [...this.files].filter(([key]) => key === prefix || key.startsWith(`${prefix}/`));
    if (matches.length === 0) throw new Error(`Missing ${from}`);
    await this.remove(scope, to);
    for (const [key, content] of matches) { this.files.delete(key); this.files.set(`${scope}:${to}${key.slice(prefix.length)}`, content); }
  }
  public async remove(scope: InstallScope, path: string) {
    for (const key of [...this.files.keys()]) if (key === `${scope}:${path}` || key.startsWith(`${scope}:${path}/`)) this.files.delete(key);
  }
  public async listFiles(scope: InstallScope, path: string) {
    return [...this.files.keys()].filter((key) => key.startsWith(`${scope}:${path}/`)).map((key) => key.slice(`${scope}:${path}/`.length)).sort();
  }
}

class FakeProfileManager implements HarnessProfileManager {
  public readonly active = new Map<string, string>();
  public readonly bridges: string[] = [];
  public async ensureBridge(profile: string) { this.bridges.push(profile); }
  public async add(profile: string, name: string, path: string) { this.active.set(`${profile}:${name}`, path); }
  public async remove(profile: string, name: string, path: string) {
    assert.equal(this.active.get(`${profile}:${name}`), path);
    this.active.delete(`${profile}:${name}`);
  }
}

function pkg(version = "1.0.0"): MarketplacePackage {
  return {
    manifest: { id: "example", qualifiedName: "@team/example", name: "@team/example", group: "team", type: "command",
      version, description: "Example", platforms: ["deepseek-harness"], delivery: ["global"], entrypoint: "package.json", tags: [] },
    sourcePath: "/Commands/example", manifestPath: "/Commands/example/ai_marketplace.yaml", hotload: false,
    source: { id: "team", label: "Team", provider: "github", repository: "repo", branch: "main", host: "github.com", owner: "team" }
  };
}

function files(version: string): PackageFile[] {
  return [
    { relativePath: "package.json", content: Buffer.from(JSON.stringify({ name: "dsh-example", version, main: "index.js", dsh: { bundle: { patch: "./cordis.patch.yml" } } })) },
    { relativePath: "cordis.patch.yml", content: Buffer.from("- insert:\n    - id: example\n      name: dsh-example\n") },
    { relativePath: "index.js", content: Buffer.from(`export const version = '${version}'\n`) }
  ];
}

const config: MarketplaceConfig = {
  repository: "team/repo", branch: "main", packageFolders: { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" },
  platformPathOverrides: {}, defaultPlatform: "deepseek-harness", deepseekHarnessProfile: "web"
};

describe("DeepSeek Harness bundle lifecycle", () => {
  it("installs, offloads, updates, hotloads, and uninstalls in one profile", async () => {
    const storage = new MemoryStorage();
    const manager = new FakeProfileManager();
    const installer = new PackageInstaller(storage, config, async (candidate) => files(candidate.manifest.version), undefined, manager);
    const first = await installer.install(pkg(), "deepseek-harness", "global");
    assert.equal(manager.active.get("web:dsh-example"), first.installedPath);
    const offloaded = await installer.offload(first);
    assert.equal(manager.active.size, 0);
    const updated = await installer.updateInstalled(pkg("1.1.0"), offloaded);
    assert.equal(updated.version, "1.1.0");
    assert.equal(manager.active.size, 0);
    const hotloaded = await installer.hotload(updated);
    assert.equal(manager.active.get("web:dsh-example"), hotloaded.installedPath);
    await installer.uninstall(hotloaded);
    assert.equal(manager.active.size, 0);
    assert.equal((await installer.listInstalled()).length, 0);
  });

  it("refuses to remove a locally modified bundle", async () => {
    const storage = new MemoryStorage();
    const manager = new FakeProfileManager();
    const installer = new PackageInstaller(storage, config, async (candidate) => files(candidate.manifest.version), undefined, manager);
    const installed = await installer.install(pkg(), "deepseek-harness", "global");
    await storage.writeFile("global", `${installed.installedPath}/index.js`, Buffer.from("changed"));
    await assert.rejects(() => installer.uninstall(installed), /modified after installation/);
    assert.equal(manager.active.size, 1);
    await storage.writeFile("global", `${installed.installedPath}/index.js`, files("1.0.0")[2]!.content);
    await storage.writeFile("global", `${installed.installedPath}/unowned.js`, Buffer.from("export const unsafe = true;"));
    await assert.rejects(() => installer.uninstall(installed), /unowned or missing files/);
  });

  it("installs and offloads workspace skills and profile-owned rules", async () => {
    const storage = new MemoryStorage();
    const manager = new FakeProfileManager();
    const installer = new PackageInstaller(storage, config, async (candidate) => [
      { relativePath: candidate.manifest.entrypoint, content: Buffer.from("# Example\n") }
    ], undefined, manager);
    const skill = { ...pkg(), manifest: { ...pkg().manifest, type: "skill" as const, entrypoint: "SKILL.md", delivery: ["workspace"] as const } };
    const rule = { ...pkg(), manifest: { ...pkg().manifest, id: "rule-example", qualifiedName: "@team/rule-example", type: "rule" as const, entrypoint: "RULE.md", delivery: ["workspace"] as const } };
    const installedSkill = await installer.install(skill, "deepseek-harness", "workspace");
    assert.equal(installedSkill.installedPath, ".dsh/skills/example");
    const installedRule = await installer.install(rule, "deepseek-harness", "workspace");
    assert.equal(installedRule.installedPath, ".dsh/rules/rule-example");
    assert.equal(installedRule.harnessProfile, "web");
    assert.deepEqual(manager.bridges, ["web"]);
    const offloaded = await installer.offload(installedRule);
    assert.match(offloaded.installedPath, /^\.offload\//);
    await installer.hotload(offloaded);
    assert.deepEqual(manager.bridges, ["web", "web"]);
    await installer.uninstall(installedSkill);
    assert.equal(await storage.exists("workspace", installedSkill.installedPath), false);
  });

  it("rejects unsafe Harness document entrypoints before writing", async () => {
    const storage = new MemoryStorage();
    const installer = new PackageInstaller(storage, config, async () => [
      { relativePath: "../outside.md", content: Buffer.from("unsafe") }
    ], undefined, new FakeProfileManager());
    const skill = { ...pkg(), manifest: { ...pkg().manifest, type: "skill" as const, entrypoint: "SKILL.md", delivery: ["workspace"] as const } };
    await assert.rejects(() => installer.install(skill, "deepseek-harness", "workspace"), /requires a Markdown entrypoint/);
    assert.equal(storage.files.size, 0);
  });
});
