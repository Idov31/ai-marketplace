import type * as vscode from "vscode";
import {
  PackageInstaller as CorePackageInstaller,
  type InstalledPackage,
  type InstallScope,
  type MarketplaceConfig,
  type MarketplacePackage,
  type McpScriptRunner,
  type PackageFile,
  type Platform
} from "@ai-marketplace/core";
import { VscodeMarketplaceStorage } from "./vscodeStorage";
import { VscodeMcpScriptRunner } from "./mcpScriptRunner";

export class PackageInstaller extends CorePackageInstaller {
  private lockDepth = 0;

  public constructor(workspaceRoot: vscode.Uri, config: MarketplaceConfig, fetchFiles: (pkg: MarketplacePackage) => Promise<readonly PackageFile[]>, mcpScriptRunner?: McpScriptRunner) {
    const storage = new VscodeMarketplaceStorage(workspaceRoot);
    super(storage, config, fetchFiles, mcpScriptRunner ?? new VscodeMcpScriptRunner(() => undefined));
    this.vscodeStorage = storage;
  }

  private readonly vscodeStorage: VscodeMarketplaceStorage;

  public override install(pkg: MarketplacePackage, platform: Platform, scope: InstallScope): Promise<InstalledPackage> {
    return this.withLock([effectiveScope(pkg, scope)], () => super.install(pkg, platform, scope));
  }

  public override update(pkg: MarketplacePackage, platform: Platform, scope: InstallScope): Promise<InstalledPackage> {
    return this.withLock([effectiveScope(pkg, scope)], () => super.install(pkg, platform, scope));
  }

  public override updateInstalled(pkg: MarketplacePackage, installed: InstalledPackage): Promise<InstalledPackage> {
    return this.withLock([effectiveInstalledScope(installed)], () => super.updateInstalled(pkg, installed));
  }

  public override migrateInstalled(pkg: MarketplacePackage, installed: InstalledPackage): Promise<InstalledPackage> {
    return this.withLock([effectiveInstalledScope(installed)], () => super.migrateInstalled(pkg, installed));
  }

  public override revertInstalled(pkg: MarketplacePackage, installed: InstalledPackage, expectedRevision: string): Promise<InstalledPackage> {
    return this.withLock([effectiveInstalledScope(installed)], () => super.revertInstalled(pkg, installed, expectedRevision));
  }

  public override async uninstall(installed: InstalledPackage): Promise<void> {
    await this.withLock([effectiveInstalledScope(installed)], () => super.uninstall(installed));
  }

  public override offload(installed: InstalledPackage): Promise<InstalledPackage> {
    return this.withLock([effectiveInstalledScope(installed)], () => super.offload(installed));
  }

  public override hotload(installed: InstalledPackage): Promise<InstalledPackage> {
    return this.withLock([effectiveInstalledScope(installed)], () => super.hotload(installed));
  }

  private async withLock<T>(scopes: readonly InstallScope[], action: () => Promise<T>): Promise<T> {
    if (this.lockDepth > 0) return action();
    return this.vscodeStorage.withOperationLock(scopes, async () => {
      this.lockDepth += 1;
      try {
        return await action();
      } finally {
        this.lockDepth -= 1;
      }
    });
  }
}

function effectiveScope(pkg: MarketplacePackage, scope: InstallScope): InstallScope {
  return pkg.manifest.type === "mcp" ? "global" : scope;
}

function effectiveInstalledScope(installed: InstalledPackage): InstallScope {
  return installed.type === "mcp" ? "global" : installed.scope;
}
