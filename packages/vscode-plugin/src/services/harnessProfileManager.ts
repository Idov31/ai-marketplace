import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import * as vscode from "vscode";
import type { HarnessProfileManager } from "@ai-marketplace/core";
import type { VscodeMarketplaceStorage } from "./vscodeStorage";

const profilePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const bundlePattern = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
const testedHarnessVersion = "0.1.5-rc.3";

export class VscodeHarnessProfileManager implements HarnessProfileManager {
  public constructor(private readonly storage: VscodeMarketplaceStorage, private readonly globalRoot = homedir(), private readonly dshHome = process.env.DSH_HOME || join(homedir(), ".dsh")) {}

  public async ensureBridge(profile: string): Promise<void> {
    const path = ".ai_marketplace/deepseek-harness/bridge";
    const source = vscode.Uri.file(resolve(__dirname, "../media/dsh-bridge"));
    const files = await Promise.all(["package.json", "cordis.patch.yml", "index.js"].map(async (relativePath) => ({
      relativePath, content: await vscode.workspace.fs.readFile(vscode.Uri.joinPath(source, relativePath))
    })));
    if (await this.storage.exists("global", path)) {
      for (const file of files) {
        const existing = await this.storage.readFile("global", `${path}/${file.relativePath}`);
        if (!existing || !Buffer.from(existing).equals(Buffer.from(file.content))) {
          throw new Error("The Marketplace-owned DeepSeek Harness bridge has changed on disk.");
        }
      }
    } else {
      await this.storage.replaceDirectory("global", path, files);
    }
    const dependency = await this.profileDependency(profile, "ai-marketplace-dsh-bridge");
    if (dependency === undefined) await this.add(profile, "ai-marketplace-dsh-bridge", path);
    else await this.assertProfileDependency(profile, "ai-marketplace-dsh-bridge", this.payloadPath(path), false);
  }

  public async add(profile: string, bundleName: string, payloadRelativePath: string): Promise<void> {
    const payload = this.payloadPath(payloadRelativePath);
    await this.assertProfileDependency(profile, bundleName, payload, true);
    await this.run(["plugin", "--profile", profile, "add", `file:${payload.replaceAll("\\", "/")}`]);
  }

  public async remove(profile: string, bundleName: string, payloadRelativePath: string): Promise<void> {
    const payload = this.payloadPath(payloadRelativePath);
    await this.assertProfileDependency(profile, bundleName, payload, false);
    await this.run(["plugin", "--profile", profile, "remove", bundleName]);
  }

  private payloadPath(relativePath: string): string {
    if (isAbsolute(relativePath) || relativePath.split(/[\\/]/).some((segment) => segment === ".." || segment === ".")) {
      throw new Error("Unsafe DeepSeek Harness bundle path.");
    }
    const target = resolve(this.globalRoot, relativePath);
    const fromRoot = relative(this.globalRoot, target);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot) || !fromRoot.startsWith(".ai_marketplace")) {
      throw new Error("DeepSeek Harness bundle must be inside the Marketplace user directory.");
    }
    return target;
  }

  private async assertProfileDependency(profile: string, bundleName: string, payload: string, allowMissing: boolean): Promise<void> {
    if (!profilePattern.test(profile) || !bundlePattern.test(bundleName)) throw new Error("Invalid DeepSeek Harness profile or bundle name.");
    const current = await this.profileDependency(profile, bundleName);
    if (current === undefined && allowMissing) return;
    const normalized = payload.replaceAll("\\", "/");
    const dependencyPath = typeof current === "string" && /^(?:file|link):/.test(current)
      ? current.slice(current.indexOf(":") + 1) : undefined;
    if (!dependencyPath || resolve(this.dshHome, "profiles", profile, dependencyPath).replaceAll("\\", "/") !== normalized) {
      throw new Error(`DeepSeek Harness bundle '${bundleName}' is absent or owned by another profile dependency.`);
    }
  }

  private async profileDependency(profile: string, bundleName: string): Promise<unknown> {
    if (!profilePattern.test(profile) || !bundlePattern.test(bundleName)) throw new Error("Invalid DeepSeek Harness profile or bundle name.");
    const manifestPath = join(this.dshHome, "profiles", profile, "package.json");
    let manifest: unknown;
    try { manifest = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(manifestPath))).toString("utf8")) as unknown; }
    catch (error) {
      if (isMissing(error)) return undefined;
      throw new Error(`Unable to inspect DeepSeek Harness profile '${profile}'.`);
    }
    return isRecord(manifest) && isRecord(manifest.dependencies) ? manifest.dependencies[bundleName] : undefined;
  }

  private async run(args: readonly string[]): Promise<void> {
    const cli = await this.resolveCli();
    const version = await this.execute(cli, ["--version"]);
    if (version.trim() !== testedHarnessVersion) {
      throw new Error(`DeepSeek Harness ${testedHarnessVersion} is required; found '${version.trim()}'.`);
    }
    await this.execute(cli, args);
  }

  private async resolveCli(): Promise<string> {
    const configured = vscode.workspace.getConfiguration("aiMarketplace").get<string>("deepseekHarnessCliPath")?.trim();
    if (configured) {
      if (!isAbsolute(configured)) throw new Error("aiMarketplace.deepseekHarnessCliPath must be absolute.");
      return configured;
    }
    const cache = process.env.npm_config_cache || join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "npm-cache");
    const npxRoot = vscode.Uri.file(join(cache, "_npx"));
    try {
      for (const [directory, kind] of await vscode.workspace.fs.readDirectory(npxRoot)) {
        if (kind !== vscode.FileType.Directory || !/^[0-9a-f]+$/.test(directory)) continue;
        const packageRoot = vscode.Uri.joinPath(npxRoot, directory, "node_modules", "@deepseek-ai", "dsh");
        try {
          const manifest = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(packageRoot, "package.json"))).toString("utf8")) as { version?: unknown };
          if (manifest.version === testedHarnessVersion) return vscode.Uri.joinPath(packageRoot, "lib", "bin.js").fsPath;
        } catch { /* Another npx session. */ }
      }
    } catch { /* No local npx cache. */ }
    return "dsh";
  }

  private async execute(cli: string, args: readonly string[]): Promise<string> {
    const windows = process.platform === "win32";
    const nodeScript = cli.toLowerCase().endsWith(".js");
    const script = "$dshArgs = @(ConvertFrom-Json $env:AI_MARKETPLACE_DSH_ARGUMENTS); & $env:AI_MARKETPLACE_DSH_COMMAND @dshArgs; exit $LASTEXITCODE";
    const command = nodeScript ? process.execPath : windows ? "powershell.exe" : cli;
    const commandArgs = nodeScript ? [cli, ...args] : windows
      ? ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")]
      : [...args];
    return new Promise<string>((resolveRun, rejectRun) => {
      const child = spawn(command, commandArgs, {
        windowsHide: true,
        env: windows && !nodeScript ? { ...process.env, AI_MARKETPLACE_DSH_ARGUMENTS: JSON.stringify(args), AI_MARKETPLACE_DSH_COMMAND: cli } : process.env,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let output = "";
      const timer = setTimeout(() => child.kill(), 120_000);
      for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk: Buffer) => { output = `${output}${chunk.toString("utf8")}`.slice(-16_384); });
      child.once("error", (error) => { clearTimeout(timer); rejectRun(error); });
      child.once("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolveRun(output);
        else rejectRun(new Error(`DeepSeek Harness profile command failed (${code ?? "terminated"}).`));
      });
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissing(value: unknown): boolean {
  return isRecord(value) && (value.code === "ENOENT" || value.code === "FileNotFound");
}
