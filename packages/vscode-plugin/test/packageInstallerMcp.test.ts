import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";
import { type PackageInstaller } from "../src/services/packageInstaller";
import { type InstalledPackage, type MarketplaceConfig, type MarketplacePackage, type McpScriptAction, type PackageFile, type Platform } from "../src/types/packages";
import type { McpScriptRequest, McpScriptRunner } from "@ai-marketplace/core";

class FakeUri {
  public constructor(public readonly fsPath: string) {}

  public static file(filePath: string): FakeUri {
    return new FakeUri(path.win32.normalize(filePath));
  }

  public static joinPath(uri: FakeUri, ...segments: readonly string[]): FakeUri {
    return new FakeUri(path.win32.normalize(path.win32.join(uri.fsPath, ...segments)));
  }
}

class FakeFileSystemError extends Error {
  public constructor(public readonly code: string) {
    super(code);
  }
}

class FakeFileSystem {
  public readonly files = new Map<string, Uint8Array>();
  public readonly directories = new Set<string>();
  public stateWriteCount = 0;

  public async readFile(uri: FakeUri): Promise<Uint8Array> {
    const file = this.files.get(normalize(uri.fsPath));
    if (!file) {
      throw new FakeFileSystemError("FileNotFound");
    }
    return file;
  }

  public async writeFile(uri: FakeUri, content: Uint8Array): Promise<void> {
    if (normalize(uri.fsPath).endsWith(".ai_marketplace\\installed.json")) {
      this.stateWriteCount += 1;
    }
    this.files.set(normalize(uri.fsPath), content);
  }

  public async createDirectory(uri: FakeUri): Promise<void> {
    this.directories.add(normalize(uri.fsPath));
  }

  public async stat(uri: FakeUri): Promise<{ type: number }> {
    const key = normalize(uri.fsPath);
    if (this.files.has(key) || [...this.files.keys()].some((item) => item.startsWith(`${key}\\`)) || this.directories.has(key)) return { type: 1 };
    throw new FakeFileSystemError("FileNotFound");
  }

  public async delete(uri: FakeUri): Promise<void> {
    const key = normalize(uri.fsPath);
    const matching = [...this.files.keys()].filter((item) => item === key || item.startsWith(`${key}\\`));
    if (matching.length === 0) {
      throw new FakeFileSystemError("FileNotFound");
    }
    matching.forEach((item) => this.files.delete(item));
  }

  public async rename(from: FakeUri, to: FakeUri): Promise<void> {
    const fromKey = normalize(from.fsPath);
    const toKey = normalize(to.fsPath);
    const matching = [...this.files].filter(([item]) => item === fromKey || item.startsWith(`${fromKey}\\`));
    if (matching.length === 0) throw new FakeFileSystemError("FileNotFound");
    for (const [item, content] of matching) {
      this.files.delete(item);
      this.files.set(`${toKey}${item.slice(fromKey.length)}`, content);
    }
    if (normalize(to.fsPath).endsWith(".ai_marketplace\\installed.json")) this.stateWriteCount += 1;
  }

  public text(relativePath: string): string | undefined {
    const file = this.files.get(homePath(relativePath));
    return file ? Buffer.from(file).toString("utf8") : undefined;
  }

  public putText(relativePath: string, content: string): void {
    this.files.set(homePath(relativePath), Buffer.from(content, "utf8"));
  }

  public workspaceText(relativePath: string): string | undefined {
    const file = this.files.get(workspacePath(relativePath));
    return file ? Buffer.from(file).toString("utf8") : undefined;
  }

  public putWorkspaceText(relativePath: string, content: string): void {
    this.files.set(workspacePath(relativePath), Buffer.from(content, "utf8"));
  }
}

const requireForTest = createRequire(__filename);
const moduleLoader = requireForTest("node:module") as { _load: (request: string, parent: unknown, isMain: boolean) => unknown };
const originalLoad = moduleLoader._load;
let activeFileSystem: FakeFileSystem | undefined;
moduleLoader._load = function loadWithVscodeMock(request: string, parent: unknown, isMain: boolean): unknown {
  if (request === "vscode") {
    return {
      Uri: FakeUri,
      FileSystemError: FakeFileSystemError,
      workspace: { get fs() { return activeFileSystem; } }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

describe("PackageInstaller MCP installs", () => {
  it("creates Codex config and records a global install", async () => {
    const { installer, fs, runner } = await createInstaller();
    const installed = await installer.install(mcpPackage(), "codex", "workspace");

    assert.equal(installed.scope, "global");
    assert.equal(installed.installedPath, ".codex/config.toml");
    assert.match(fs.text(".codex/config.toml") ?? "", /\[mcp_servers\.my-mcp\]/);
    assert.equal(fs.directories.has(homePath(".codex")), true);
    const state = JSON.parse(fs.text(".ai_marketplace/installed.json") ?? "{}") as {
      schemaVersion: number;
      packages: readonly { scope: string; installedPath: string; sourceId?: string; qualifiedName?: string }[];
    };
    assert.equal(state.schemaVersion, 2);
    assert.deepEqual(state.packages.map((item) => [item.scope, item.installedPath]), [["global", ".codex/config.toml"]]);
    assert.equal(state.packages[0].sourceId, "default");
    assert.equal(state.packages[0].qualifiedName, "@team/my-mcp");
    assert.equal(installed.managedPayloadPath, ".ai_marketplace/mcp-packages/codex/default/my-mcp");
    assert.equal(fs.text(`${installed.managedPayloadPath}/install.py`), "# install");
    assert.deepEqual(runner.requests.map(({ script, action, platform, timeoutMs }) => ({ script, action, platform, timeoutMs })), [
      { script: "install.py", action: "install", platform: "codex", timeoutMs: 600_000 }
    ]);
  });

  it("writes Cursor, Copilot, and Claude MCP JSON configuration", async () => {
    const { installer, fs } = await createInstaller();
    await installer.install(mcpPackage(), "cursor", "global");
    await installer.install(mcpPackage(), "github-copilot", "global");
    await installer.install(mcpPackage(), "claude", "global");

    assert.deepEqual(JSON.parse(fs.text(".cursor/mcp.json") ?? "{}"), {
      mcpServers: { "my-mcp": { type: "stdio", command: "npx", args: ["server"] } }
    });
    assert.deepEqual(JSON.parse(fs.text(".copilot/mcp-config.json") ?? "{}"), {
      mcpServers: { "my-mcp": { type: "stdio", command: "npx", args: ["server"] } }
    });
    assert.deepEqual(JSON.parse(fs.text(".claude.json") ?? "{}"), {
      mcpServers: { "my-mcp": { type: "stdio", command: "npx", args: ["server"] } }
    });
  });

  it("removes only the managed server and does not recreate a missing config", async () => {
    const { installer, fs, runner } = await createInstaller();
    fs.putText(".copilot/mcp-config.json", JSON.stringify({ mcpServers: { existing: { command: "node" } } }));
    const installed = await installer.install(mcpPackage(), "github-copilot", "global");
    await installer.uninstall(installed);
    assert.deepEqual(JSON.parse(fs.text(".copilot/mcp-config.json") ?? "{}"), { mcpServers: { existing: { command: "node" } } });
    assert.equal(runner.requests.at(-1)?.action, "uninstall");

    const codex = await installer.install(mcpPackage(), "codex", "global");
    fs.files.delete(homePath(".codex/config.toml"));
    await installer.uninstall(codex);
    assert.equal(fs.text(".codex/config.toml"), undefined);
  });

  it("aborts before config and state mutation when install.py fails", async () => {
    const runner = new FakeMcpScriptRunner();
    runner.failAction = "install";
    const { installer, fs } = await createInstaller(async () => files(), runner);
    fs.putText(".codex/config.toml", "[settings]\nkeep = true\n");

    await assert.rejects(() => installer.install(mcpPackage(), "codex", "global"), /script install failed/);

    assert.equal(fs.text(".codex/config.toml"), "[settings]\nkeep = true\n");
    assert.equal(fs.text(".ai_marketplace/installed.json"), undefined);
    assert.equal(fs.text(".ai_marketplace/mcp-packages/codex/default/my-mcp/install.py"), undefined);
  });

  it("refuses to execute a tampered managed payload path", async () => {
    const { installer, runner } = await createInstaller();
    const installed = await installer.install(mcpPackage(), "codex", "global");

    await assert.rejects(() => installer.uninstall({ ...installed, managedPayloadPath: ".ssh" }), /unexpected managed payload path/);

    assert.equal(runner.requests.filter((request) => request.action === "uninstall").length, 0);
  });

  it("does not replace an unowned MCP payload directory", async () => {
    const { installer, fs, runner } = await createInstaller();
    fs.putText(".ai_marketplace/mcp-packages/codex/default/my-mcp/keep.txt", "user data");

    await assert.rejects(() => installer.install(mcpPackage(), "codex", "global"), /without matching installed ownership/);

    assert.equal(fs.text(".ai_marketplace/mcp-packages/codex/default/my-mcp/keep.txt"), "user data");
    assert.equal(runner.requests.length, 0);
  });

  it("restores the prior cached payload and state when an MCP update script fails", async () => {
    const runner = new FakeMcpScriptRunner();
    const { installer, fs } = await createInstaller(async (pkg) => files(pkg.manifest.version), runner);
    const installed = await installer.install(mcpPackage(), "codex", "global");
    runner.failAction = "update";

    await assert.rejects(() => installer.updateInstalled({ ...mcpPackage(), manifest: { ...mcpPackage().manifest, version: "2.0.0" } }, installed), /script update failed/);

    assert.equal(fs.text(`${installed.managedPayloadPath}/install.py`), "# install 1.0.0");
    const state = JSON.parse(fs.text(".ai_marketplace/installed.json") ?? "{}") as { packages: readonly { version: string }[] };
    assert.equal(state.packages[0].version, "1.0.0");
  });

  it("migrates legacy folder-based MCP state after configuring the host", async () => {
    const { installer, fs } = await createInstaller();
    fs.putText(".ai_marketplace/installed.json", JSON.stringify({ packages: [{
      id: "my-mcp", type: "mcp", platform: "codex", scope: "global", version: "0.9.0", sourceRepo: "repo", sourceBranch: "main",
      sourcePath: "/Mcps/my-mcp", installedPath: ".codex/mcps/my-mcp", installedAt: "2026-06-01T00:00:00.000Z"
    }] }));
    fs.putText(".codex/mcps/my-mcp/package.json", "{}");

    await installer.install(mcpPackage(), "codex", "global");

    assert.equal(fs.text(".codex/mcps/my-mcp/package.json"), undefined);
    const state = JSON.parse(fs.text(".ai_marketplace/installed.json") ?? "{}") as { packages: readonly { installedPath: string }[] };
    assert.deepEqual(state.packages.map((item) => item.installedPath), [".codex/config.toml"]);
  });

  it("blocks a same-id MCP server owned by another source", async () => {
    const { installer } = await createInstaller();
    await installer.install(mcpPackage(), "claude", "global");
    await assert.rejects(() => installer.install(packageFromSource("other"), "claude", "global"), /another package source/);
  });

  it("records rollback provenance, pins auto update, and clears both on manual update", async () => {
    const { installer, fs, runner } = await createInstaller();
    const current = await installer.install(mcpPackage(), "codex", "global");
    const revision = "a".repeat(40);
    const historical: MarketplacePackage = {
      ...mcpPackage(),
      manifest: { ...mcpPackage().manifest, version: "0.9.0" },
      sourceRevision: revision
    };

    await assert.rejects(
      () => installer.revertInstalled({ ...historical, sourceRevision: undefined }, current, revision),
      /snapshot revision does not match/
    );
    const writesBeforeRevert = fs.stateWriteCount;
    const reverted = await installer.revertInstalled(historical, current, revision);
    assert.equal(fs.stateWriteCount, writesBeforeRevert + 1);
    assert.equal(reverted.version, "0.9.0");
    assert.equal(reverted.sourceRevision, revision);
    assert.equal(reverted.autoUpdate, false);
    assert.equal(reverted.revertedFromVersion, "1.0.0");
    assert.ok(reverted.revertedAt);

    await assert.rejects(
      () => installer.revertInstalled(historical, { ...current, installedPath: "unexpected/path" }, revision),
      /not compatible/
    );

    await installer.updateInstalled(mcpPackage(), reverted);
    const state = JSON.parse(fs.text(".ai_marketplace/installed.json") ?? "{}") as {
      packages: readonly { autoUpdate?: boolean; revertedAt?: string; revertedFromVersion?: string }[];
    };
    assert.equal(state.packages[0].autoUpdate, undefined);
    assert.equal(state.packages[0].revertedAt, undefined);
    assert.equal(state.packages[0].revertedFromVersion, undefined);
    assert.deepEqual(runner.requests.map((request) => request.action), ["install", "revert", "update"]);
  });
});

describe("PackageInstaller Claude and collision behavior", () => {
  it("materializes Codex agents as top-level TOML while retaining companion resources", async () => {
    const pkg = packageForType("agent", "triage", "triage.toml");
    const { installer, fs } = await createInstaller(async () => [
      { relativePath: "ai_marketplace.yaml", content: Buffer.from("manifest") },
      { relativePath: "triage.toml", content: Buffer.from('name = "triage"\ndescription = "Triage issues"\ndeveloper_instructions = "Investigate"\n') },
      { relativePath: "references/checklist.md", content: Buffer.from("# Checklist") }
    ]);

    const installed = await installer.install(pkg, "codex", "workspace");

    assert.equal(installed.installedPath, ".codex/agents/triage");
    assert.equal(installed.managedConfig?.kind, "codex-agent");
    assert.equal((await installer.listInstalled())[0]?.managedConfig?.kind, "codex-agent");
    assert.match(fs.workspaceText(".codex/agents/triage.toml") ?? "", /developer_instructions/);
    assert.equal(fs.workspaceText(".codex/agents/triage/references/checklist.md"), "# Checklist");

    const offloaded = await installer.offload(installed);
    assert.equal(fs.workspaceText(".codex/agents/triage.toml"), undefined);
    assert.equal(fs.workspaceText(".offload/codex/agents/triage/references/checklist.md"), "# Checklist");

    const hotloaded = await installer.hotload(offloaded);
    assert.match(fs.workspaceText(".codex/agents/triage.toml") ?? "", /developer_instructions/);
    assert.equal(fs.workspaceText(".codex/agents/triage/references/checklist.md"), "# Checklist");

    await installer.uninstall(hotloaded);
    assert.equal(fs.workspaceText(".codex/agents/triage.toml"), undefined);
    assert.equal(fs.workspaceText(".codex/agents/triage/references/checklist.md"), undefined);
  });

  it("does not overwrite or remove unowned or modified Codex agent TOML files", async () => {
    const pkg = packageForType("agent", "triage", "triage.toml");
    const fetchFiles = async () => [
      { relativePath: "triage.toml", content: Buffer.from('name = "triage"\n') }
    ];
    const { installer, fs } = await createInstaller(fetchFiles);
    fs.putWorkspaceText(".codex/agents/triage.toml", "user-owned");

    await assert.rejects(() => installer.install(pkg, "codex", "workspace"), /without matching installed ownership/);
    assert.equal(fs.workspaceText(".codex/agents/triage.toml"), "user-owned");

    fs.files.delete(workspacePath(".codex/agents/triage.toml"));
    const installed = await installer.install(pkg, "codex", "workspace");
    fs.putWorkspaceText(".codex/agents/triage.toml", "user-modified");
    await assert.rejects(() => installer.uninstall(installed), /modified after installation/);
    assert.equal(fs.workspaceText(".codex/agents/triage.toml"), "user-modified");
    assert.equal(fs.workspaceText(".codex/agents/triage/triage.toml"), 'name = "triage"\n');
  });

  it("rejects legacy Markdown entrypoints for Codex agents", async () => {
    const pkg = packageForType("agent", "triage", "AGENT.md");
    const { installer } = await createInstaller(async () => [
      { relativePath: "AGENT.md", content: Buffer.from("# Triage") }
    ]);

    await assert.rejects(() => installer.install(pkg, "codex", "workspace"), /entrypoint must be 'triage\.toml'/);
  });

  it("installs Claude agents as a single Markdown file without AI Marketplace metadata", async () => {
    const pkg = packageForType("agent", "triage", "AGENT.md");
    const { installer, fs } = await createInstaller(async () => [
      { relativePath: "ai_marketplace.yaml", content: Buffer.from("canonical manifest") },
      { relativePath: "AGENT.md", content: Buffer.from("# Triage") }
    ]);

    const installed = await installer.install(pkg, "claude", "workspace");

    assert.equal(installed.installedPath, ".claude/agents/triage.md");
    assert.equal(fs.workspaceText(".claude/agents/triage.md"), "# Triage");
    assert.equal(fs.workspaceText(".claude/agents/triage.md/ai_marketplace.yaml"), undefined);
  });

  it("merges and removes only a Claude hook package contribution", async () => {
    const pkg = packageForType("hook", "prompt-guard", "hooks.json");
    const { installer, fs } = await createInstaller(async () => [{
      relativePath: "hooks.json",
      content: Buffer.from(JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "guard" }] }] } }))
    }]);
    fs.putWorkspaceText(".claude/settings.json", JSON.stringify({ theme: "dark", hooks: { Stop: [{ hooks: [] }] } }));

    const installed = await installer.install(pkg, "claude", "workspace");
    const configured = JSON.parse(fs.workspaceText(".claude/settings.json") ?? "{}") as { hooks: Record<string, unknown>; theme: string };
    assert.equal(configured.theme, "dark");
    assert.ok(configured.hooks.PreToolUse);
    assert.ok(configured.hooks.Stop);

    await installer.uninstall(installed);
    const removed = JSON.parse(fs.workspaceText(".claude/settings.json") ?? "{}") as { hooks: Record<string, unknown>; theme: string };
    assert.equal(removed.theme, "dark");
    assert.equal(removed.hooks.PreToolUse, undefined);
    assert.ok(removed.hooks.Stop);
  });

  it("updates an offloaded Claude hook without restoring its active settings contribution", async () => {
    const pkg = packageForType("hook", "prompt-guard", "hooks.json");
    const { installer, fs } = await createInstaller(async () => [{
      relativePath: "hooks.json",
      content: Buffer.from(JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "new-guard" }] }] } }))
    }]);
    const offloaded: InstalledPackage = {
      id: "prompt-guard", type: "hook", platform: "claude", scope: "workspace", version: "1.0.0", sourceRepo: "example/repo", sourceBranch: "main",
      sourcePath: "/hook/prompt-guard", sourceId: "default", qualifiedName: "@team/prompt-guard", group: "team",
      managedConfig: { kind: "hook", hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "old-guard" }] }] } },
      installedPath: ".offload/claude/hooks/prompt-guard", installedAt: "2026-01-01T00:00:00.000Z", hotloaded: false
    };

    const updated = await installer.updateInstalled({ ...pkg, manifest: { ...pkg.manifest, version: "2.0.0" } }, offloaded);
    assert.equal(updated.installedPath, offloaded.installedPath);
    assert.equal(updated.version, "2.0.0");
    assert.match(fs.workspaceText(".offload/claude/hooks/prompt-guard/hooks.json") ?? "", /new-guard/);
    assert.equal(fs.workspaceText(".claude/hooks/prompt-guard/hooks.json"), undefined);
    assert.equal(fs.workspaceText(".claude/settings.json"), undefined);
  });

  it("blocks cross-source installs that resolve to the same path", async () => {
    const { installer } = await createInstaller(async () => [{ relativePath: "SKILL.md", content: Buffer.from("# Skill") }]);
    const first = packageForType("skill", "same-id", "SKILL.md");
    await installer.install(first, "codex", "workspace");
    await assert.rejects(
      () => installer.install({ ...first, source: { ...first.source, id: "other", label: "Other", repository: "other" } }, "codex", "workspace"),
      /already managed/
    );
  });
});

async function createInstaller(
  fetchFiles: (pkg: MarketplacePackage) => Promise<readonly PackageFile[]> = async () => files(),
  runner = new FakeMcpScriptRunner()
): Promise<{ readonly installer: PackageInstaller; readonly fs: FakeFileSystem; readonly runner: FakeMcpScriptRunner }> {
  activeFileSystem = new FakeFileSystem();
  const { PackageInstaller } = await import("../src/services/packageInstaller.js");
  return {
    installer: new PackageInstaller(FakeUri.file(path.win32.join(os.homedir(), "workspace")) as never, config(), fetchFiles, runner),
    fs: activeFileSystem,
    runner
  };
}

function packageFromSource(sourceId: string): MarketplacePackage {
  const pkg = mcpPackage();
  return { ...pkg, source: { ...pkg.source, id: sourceId, label: sourceId, repository: sourceId } };
}

function packageForType(
  type: "skill" | "agent" | "hook",
  id: string,
  entrypoint: string
): MarketplacePackage {
  return {
    manifest: {
      id,
      qualifiedName: `@team/${id}`,
      name: `@team/${id}`,
      group: "team",
      type,
      version: "1.0.0",
      description: id,
      platforms: ["codex", "github-copilot", "claude"],
      delivery: ["workspace", "global"],
      entrypoint,
      tags: [type]
    },
    sourcePath: `/${type}/${id}`,
    manifestPath: `/${type}/${id}/ai_marketplace.yaml`,
    hotload: true,
    source: { id: "default", label: "Default", provider: "github", host: "github.com", owner: "example", repository: "repo", branch: "main" }
  };
}

function mcpPackage(): MarketplacePackage {
  return {
    manifest: {
      id: "my-mcp", qualifiedName: "@team/my-mcp", name: "@team/my-mcp", group: "team", type: "mcp", version: "1.0.0", description: "Connects an MCP server.",
      platforms: ["codex", "cursor", "github-copilot", "claude"], delivery: ["global"], entrypoint: ".mcp.json", tags: ["mcp"]
    },
    sourcePath: "/Mcps/my-mcp", manifestPath: "/Mcps/my-mcp/ai_marketplace.yaml", hotload: false,
    source: { id: "default", label: "Default", provider: "github", host: "github.com", owner: "example", repository: "repo", branch: "main" }
  };
}

function files(version = ""): readonly PackageFile[] {
  return [{
    relativePath: ".mcp.json",
    content: Buffer.from(JSON.stringify({ mcpServers: { upstream_name: { type: "stdio", command: "npx", args: ["server"] } } }), "utf8")
  }, { relativePath: "install.py", content: Buffer.from(`# install${version ? ` ${version}` : ""}`) }, { relativePath: "uninstall.py", content: Buffer.from("# uninstall") }];
}

class FakeMcpScriptRunner implements McpScriptRunner {
  public readonly requests: McpScriptRequest[] = [];
  public failAction?: McpScriptAction;
  public async run(request: McpScriptRequest): Promise<void> {
    this.requests.push(request);
    if (request.action === this.failAction) throw new Error(`script ${request.action} failed`);
  }
}

function config(): MarketplaceConfig {
  return {
    repository: "repo", branch: "main",
    packageFolders: { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" },
    platformPathOverrides: {}, defaultPlatform: "codex"
  };
}

function normalize(value: string): string {
  return path.win32.normalize(value);
}

function homePath(relativePath: string): string {
  return normalize(path.win32.join(os.homedir(), ...relativePath.split("/")));
}

function workspacePath(relativePath: string): string {
  return normalize(path.win32.join(os.homedir(), "workspace", ...relativePath.split("/")));
}
