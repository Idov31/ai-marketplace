import { createHash, randomUUID } from "node:crypto";
import { type ManagedConfigContribution, type McpScriptAction, type PackageFile, type InstalledPackage, type MarketplacePackage, type MarketplaceConfig, type Platform, type InstallScope, type PackageMigrationSnapshot } from "../types/packages";
import { cloudInstallPath, codexAgentConfigRelativePath, installRelativePath, mcpPayloadRelativePath, offloadRelativePath, safeJoinRelative } from "./pathPlanning";
import { type MarketplaceStorage, type McpScriptRunner } from "../ports";
import { uninstallTargetPaths } from "./installPlanning";
import { InstalledStateStore } from "./installedState";
import { filterPackageFilesForPlatform } from "./packageFiles";
import { matchesMigration } from "./migrationPlanning";
import { compareVersions } from "./versioning";
import {
  mcpConfigRelativePath,
  readClaudeHookConfig,
  readMcpHostConfig,
  removeClaudeHookConfig,
  removeCodexMcpServer,
  removeJsonMcpServer,
  upsertClaudeHookConfig,
  upsertCodexMcpServer,
  upsertJsonMcpServer
} from "./mcpConfig";
import { assertMcpPackageScripts, mcpInstallScript, mcpScriptTimeoutMs, mcpUninstallScript } from "./mcpScripts";
import { repositoryIdentity } from "./repositoryUrl";
import { isRootManifestFile } from "./manifestSchema";

export class PackageInstaller {
  public constructor(
    private readonly storage: MarketplaceStorage,
    private readonly config: MarketplaceConfig,
    private readonly fetchFiles: (pkg: MarketplacePackage) => Promise<readonly PackageFile[]>,
    private readonly mcpScriptRunner?: McpScriptRunner
  ) {}

  public async listInstalled(): Promise<readonly InstalledPackage[]> {
    await this.recoverMigration("workspace");
    await this.recoverMigration("global");
    const workspace = await this.stateStore("workspace").read();
    const global = await this.stateStore("global").read();
    return [...workspace.packages, ...global.packages];
  }

  public async install(pkg: MarketplacePackage, platform: Platform, scope: InstallScope): Promise<InstalledPackage> {
    if (pkg.manifest.type === "mcp") {
      return this.installMcp(pkg, platform, "install");
    }
    if (pkg.manifest.type === "hook" && platform === "claude") {
      return this.installClaudeHook(pkg, scope);
    }
    const installPath = scope === "cloud"
      ? cloudInstallPath(platform, pkg.manifest.type, pkg.manifest.id)
      : installRelativePath(platform, pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
    let managedConfig: ManagedConfigContribution | undefined;
    if (scope !== "cloud") {
      await this.assertNoInstallCollision(pkg, platform, scope, installPath);
      const files = filterPackageFilesForPlatform(await this.fetchFiles(pkg), platform);
      managedConfig = codexAgentContribution(pkg, platform, files, this.config);
      await this.assertCodexAgentConfigAvailable(pkg, scope, installPath, managedConfig);
      await this.replacePackage(scope, installPath, files, pkg, platform);
    }

    const installed: InstalledPackage = {
      id: pkg.manifest.id,
      type: pkg.manifest.type,
      platform,
      scope,
      version: pkg.manifest.version,
      sourceRepo: sourceRepository(pkg),
      sourceBranch: pkg.source.branch,
      sourcePath: pkg.sourcePath,
      ...sourceMetadata(pkg),
      ...(managedConfig === undefined ? {} : { managedConfig }),
      installedPath: installPath,
      installedAt: new Date().toISOString()
    };
    await this.stateStore(scope).upsert(installed);
    return installed;
  }

  public async update(pkg: MarketplacePackage, platform: Platform, scope: InstallScope): Promise<InstalledPackage> {
    return this.install(pkg, platform, scope);
  }

  public async updateInstalled(pkg: MarketplacePackage, installed: InstalledPackage): Promise<InstalledPackage> {
    if (pkg.manifest.type === "mcp") {
      return this.installMcp(pkg, installed.platform, "update", installed.installedAt, installed, true, (updated) => ({
        ...updated,
        autoUpdate: undefined,
        autoUpdateChangedAt: undefined,
        revertedAt: undefined,
        revertedFromVersion: undefined
      }));
    }
    const updated = await this.mutateInstalled(pkg, installed);
    const current: InstalledPackage = {
      ...updated,
      autoUpdate: undefined,
      autoUpdateChangedAt: undefined,
      revertedAt: undefined,
      revertedFromVersion: undefined
    };
    await this.stateStore(installed.scope).upsert(current);
    return current;
  }

  public async revertInstalled(pkg: MarketplacePackage, installed: InstalledPackage, expectedRevision: string): Promise<InstalledPackage> {
    if (pkg.sourceRevision === undefined || pkg.sourceRevision !== expectedRevision) {
      throw new Error("Rollback snapshot revision does not match the current manifest previous_version.");
    }
    this.assertCompatibleRollback(pkg, installed);
    if (pkg.manifest.type === "mcp") {
      return this.installMcp(pkg, installed.platform, "revert", installed.installedAt, installed, true, (updated) => ({
        ...updated,
        autoUpdate: false,
        autoUpdateChangedAt: new Date().toISOString(),
        revertedAt: new Date().toISOString(),
        revertedFromVersion: installed.version
      }));
    }
    const updated = await this.mutateInstalled(pkg, installed);
    const reverted: InstalledPackage = {
      ...updated,
      autoUpdate: false,
      autoUpdateChangedAt: new Date().toISOString(),
      revertedAt: new Date().toISOString(),
      revertedFromVersion: installed.version
    };
    await this.stateStore(installed.scope).upsert(reverted);
    return reverted;
  }

  /** Replaces an explicitly declared predecessor while preserving its target and user metadata. */
  public async migrateInstalled(pkg: MarketplacePackage, predecessor: InstalledPackage): Promise<InstalledPackage> {
    if (!(pkg.manifest.migrations ?? []).some((migration) => matchesMigration(pkg, migration, predecessor))) {
      throw new Error("Destination package does not declare the selected predecessor.");
    }
    if (pkg.manifest.type !== predecessor.type || !pkg.manifest.platforms.includes(predecessor.platform)
      || !pkg.manifest.delivery.includes(predecessor.scope) || compareVersions(pkg.manifest.version, predecessor.version) < 0) {
      throw new Error("Destination package is not compatible with the selected predecessor installation.");
    }
    if (predecessor.platform === "codex" && predecessor.type === "agent") {
      throw new Error("Codex agent identity migrations are not yet supported; uninstall the predecessor before installing the destination.");
    }
    if (!isCanonicalInstalledPath(predecessor, this.config)) throw new Error("Installed predecessor uses an unexpected managed path.");
    const files = await this.fetchFiles(pkg);
    assertMcpPackageScripts(pkg, files);
    const offloaded = predecessor.installedPath.startsWith(".offload/");
    const targetPath = predecessor.type === "mcp"
      ? predecessor.installedPath
      : predecessor.scope === "cloud"
        ? cloudInstallPath(predecessor.platform, predecessor.type, pkg.manifest.id)
        : offloaded
          ? offloadRelativePath(predecessor.platform, predecessor.type, pkg.manifest.id)
          : installRelativePath(predecessor.platform, predecessor.type, pkg.manifest.id, this.config.platformPathOverrides);
    await this.assertMigrationDestinationAvailable(pkg, predecessor, targetPath);

    const operationId = randomUUID();
    const journalPath = migrationJournalPath();
    const backupRoot = `.ai_marketplace/migrations/${operationId}`;
    const payloadBackup = predecessor.scope === "cloud" || predecessor.type === "mcp" ? undefined : `${backupRoot}/payload`;
    const configPath = migrationConfigPath(predecessor);
    const configBackup = configPath ? `${backupRoot}/config` : undefined;
    const existingConfig = configPath ? await this.readOptionalText(predecessor.scope, configPath) : undefined;
    const nextConfig = !configPath ? undefined : predecessor.type === "mcp"
      ? this.migratedMcpConfig(pkg, predecessor, files, existingConfig)
      : this.migratedClaudeHookConfig(pkg, predecessor, files, existingConfig);
    if (predecessor.type === "mcp") {
      const destinationPayload = mcpPayloadRelativePath(predecessor.platform, pkg.source.id, pkg.manifest.id);
      if (await this.storage.exists("global", destinationPayload) && predecessor.managedPayloadPath !== destinationPayload) {
        throw new Error(`Managed MCP payload path '${destinationPayload}' already exists without matching installed ownership.`);
      }
    }
    const now = new Date().toISOString();
    const next = this.migratedRecord(pkg, predecessor, targetPath, now, files);
    const journal: MigrationJournal = { operationId, previous: migrationJournalPrevious(predecessor), next: migrationJournalNext(next), targetPath, payloadBackup, configPath, configBackup };
    await this.writeText(predecessor.scope, journalPath, `${JSON.stringify(journal, null, 2)}\n`);

    let preparedMcpPayload: PreparedMcpPayload | undefined;
    let stateCommitted = false;
    try {
      if (predecessor.type === "mcp") {
        if (predecessor.managedPayloadPath) {
          await this.runMcpScript(predecessor.managedPayloadPath, mcpUninstallScript, "migrate", predecessor.platform);
        }
        preparedMcpPayload = await this.prepareMcpPayload(pkg, predecessor.platform, files, "migrate", predecessor.managedPayloadPath);
      }
      if (configPath) {
        if (await this.storage.exists(predecessor.scope, configPath)) await this.storage.move(predecessor.scope, configPath, configBackup!);
      }
      if (payloadBackup && await this.storage.exists(predecessor.scope, predecessor.installedPath)) {
        await this.storage.move(predecessor.scope, predecessor.installedPath, payloadBackup);
      }
      if (nextConfig !== undefined && configPath) await this.writeText(predecessor.scope, configPath, nextConfig);
      if (predecessor.scope !== "cloud" && predecessor.type !== "mcp") {
        await this.replacePackage(predecessor.scope, targetPath, filterPackageFilesForPlatform(files, predecessor.platform), pkg, predecessor.platform);
      }
      await this.stateStore(predecessor.scope).replace(predecessor, next);
      stateCommitted = true;
      if (predecessor.type === "mcp" && preparedMcpPayload) {
        if (predecessor.managedPayloadPath && predecessor.managedPayloadPath !== preparedMcpPayload.path) {
          await this.storage.remove("global", predecessor.managedPayloadPath).catch(() => undefined);
        }
        await this.commitMcpPayload(preparedMcpPayload);
      }
      await this.storage.remove(predecessor.scope, backupRoot).catch(() => undefined);
      await this.storage.remove(predecessor.scope, journalPath).catch(() => undefined);
      return next;
    } catch (error) {
      if (preparedMcpPayload && !stateCommitted) await this.rollbackMcpPayload(preparedMcpPayload).catch(() => undefined);
      await this.rollbackMigration(journal).catch(() => undefined);
      throw error;
    }
  }

  private async mutateInstalled(pkg: MarketplacePackage, installed: InstalledPackage): Promise<InstalledPackage> {
    let updated: InstalledPackage;
    if (pkg.manifest.type === "hook" && installed.platform === "claude") {
      updated = isOffloaded(installed)
        ? await this.updateOffloadedClaudeHook(pkg, installed)
        : await this.installClaudeHook(pkg, installed.scope, installed.installedAt, installed, false);
    } else {
      if (installed.scope !== "cloud") {
        const files = filterPackageFilesForPlatform(await this.fetchFiles(pkg), installed.platform);
        const managedConfig = codexAgentContribution(pkg, installed.platform, files, this.config);
        await this.assertCodexAgentConfigAvailable(pkg, installed.scope, installed.installedPath, managedConfig, installed);
        await this.replacePackage(installed.scope, installed.installedPath, files, pkg, installed.platform);
        updated = {
          ...installed,
          version: pkg.manifest.version,
          sourceRepo: sourceRepository(pkg),
          sourceBranch: pkg.source.branch,
          sourcePath: pkg.sourcePath,
          ...sourceMetadata(pkg),
          ...(managedConfig === undefined ? {} : { managedConfig })
        };
        return updated;
      }
      updated = {
        ...installed,
        version: pkg.manifest.version,
        sourceRepo: sourceRepository(pkg),
        sourceBranch: pkg.source.branch,
        sourcePath: pkg.sourcePath,
        ...sourceMetadata(pkg)
      };
    }
    return updated;
  }

  public async uninstall(installed: InstalledPackage): Promise<void> {
    if (installed.type === "mcp") {
      await this.uninstallMcp(installed);
      return;
    }
    if (installed.type === "hook" && installed.platform === "claude") {
      await this.uninstallClaudeHook(installed);
      return;
    }
    if (installed.scope !== "cloud") {
      await this.assertManagedCodexAgentConfigUnmodified(installed);
      for (const path of uninstallTargetPaths(installed, this.config)) {
        await this.deleteRelativeDirectory(installed.scope, path);
      }
    }
    await this.stateStore(installed.scope).remove(installed.id, installed.platform, installed.scope, installed.sourceId);
  }

  public async offload(installed: InstalledPackage): Promise<InstalledPackage> {
    if (installed.scope === "cloud") {
      throw new Error("Cloud packages cannot be offloaded.");
    }
    if (installed.type === "mcp") {
      throw new Error("MCP packages cannot be offloaded.");
    }
    if (installed.type === "hook" && installed.platform === "claude") {
      await this.removeClaudeHookContribution(installed);
    }
    await this.assertManagedCodexAgentConfigUnmodified(installed);
    const offloadPath = offloadRelativePath(installed.platform, installed.type, installed.id);
    await this.moveDirectory(installed.scope, installed.installedPath, offloadPath);
    if (installed.managedConfig?.kind === "codex-agent") {
      await this.deleteRelativeDirectory(installed.scope, installed.managedConfig.configPath);
    }
    const moved = {
      ...installed,
      installedPath: offloadPath,
      hotloaded: false,
      offloadRequestedAt: new Date().toISOString()
    };
    await this.stateStore(installed.scope).upsert(moved);
    return moved;
  }

  public async hotload(installed: InstalledPackage): Promise<InstalledPackage> {
    if (installed.scope === "cloud") {
      throw new Error("Cloud packages cannot be hotloaded.");
    }
    if (installed.type === "mcp") {
      throw new Error("MCP packages cannot be hotloaded.");
    }
    if (installed.type === "hook" && installed.platform === "claude") {
      await this.restoreClaudeHookContribution(installed);
    }
    await this.assertManagedCodexAgentConfigUnmodified(installed);
    const activePath = installRelativePath(installed.platform, installed.type, installed.id, this.config.platformPathOverrides);
    if (installed.managedConfig?.kind === "codex-agent" && await this.storage.exists(installed.scope, installed.managedConfig.configPath)) {
      throw new Error(`Codex agent config '${installed.managedConfig.configPath}' already exists while the package is offloaded.`);
    }
    await this.moveDirectory(installed.scope, installed.installedPath, activePath);
    if (installed.managedConfig?.kind === "codex-agent") {
      await this.materializeCodexAgentConfig(installed.scope, activePath, installed.id, installed.managedConfig);
    }
    const moved = {
      ...installed,
      installedPath: activePath,
      hotloaded: true,
      hotloadRequestedAt: new Date().toISOString()
    };
    await this.stateStore(installed.scope).upsert(moved);
    return moved;
  }

  private stateStore(scope: InstallScope): InstalledStateStore {
    return new InstalledStateStore(this.storage, scope);
  }

  private async installMcp(
    pkg: MarketplacePackage,
    platform: Platform,
    action: "install" | "update" | "revert",
    installedAt = new Date().toISOString(),
    previous?: InstalledPackage,
    persistState = true,
    transform: (installed: InstalledPackage) => InstalledPackage = (installed) => installed
  ): Promise<InstalledPackage> {
    await this.assertNoMcpCollision(pkg, platform, previous);
    const files = await this.fetchFiles(pkg);
    assertMcpPackageScripts(pkg, files);
    const hostConfig = readMcpHostConfig(pkg, platform, files);
    const installedPath = mcpConfigRelativePath(platform);
    const existingContent = await this.readOptionalText("global", installedPath);
    const nextContent = platform === "codex"
      ? upsertCodexMcpServer(existingContent, hostConfig.serverName, hostConfig.serverConfig, managedMcpConfig(previous)?.serverConfig)
      : upsertJsonMcpServer(existingContent, hostConfig.serverName, hostConfig.serverConfig, managedMcpConfig(previous)?.serverConfig);
    const preparedPayload = await this.prepareMcpPayload(pkg, platform, files, action, previous?.managedPayloadPath);
    let configWritten = false;
    try {
      await this.writeText("global", installedPath, nextContent);
      configWritten = true;

      const installed = transform({
        id: pkg.manifest.id,
        type: "mcp",
        platform,
        scope: "global",
        version: pkg.manifest.version,
        sourceRepo: sourceRepository(pkg),
        sourceBranch: pkg.source.branch,
        sourcePath: pkg.sourcePath,
        ...sourceMetadata(pkg),
        managedConfig: { kind: "mcp", serverName: hostConfig.serverName, serverConfig: hostConfig.serverConfig },
        managedPayloadPath: preparedPayload.path,
        installedPath,
        installedAt
      });
      if (persistState) await this.stateStore("global").upsert(installed);
      await this.removeLegacyMcpInstallations(pkg.manifest.id, platform, installedPath).catch(() => undefined);
      await this.commitMcpPayload(preparedPayload);
      return installed;
    } catch (error) {
      await this.rollbackMcpPayload(preparedPayload).catch(() => undefined);
      if (configWritten) {
        if (existingContent === undefined) await this.storage.remove("global", installedPath).catch(() => undefined);
        else await this.writeText("global", installedPath, existingContent).catch(() => undefined);
      }
      throw error;
    }
  }

  private async uninstallMcp(installed: InstalledPackage): Promise<void> {
    const configPath = mcpConfigRelativePath(installed.platform);
    if (installed.scope !== "global" || installed.installedPath !== configPath) {
      for (const path of uninstallTargetPaths(installed, this.config)) {
        await this.deleteRelativeDirectory(installed.scope, path);
      }
      await this.stateStore(installed.scope).remove(installed.id, installed.platform, installed.scope, installed.sourceId);
      return;
    }

    if (installed.managedPayloadPath) {
      if (!installed.sourceId || installed.managedPayloadPath !== mcpPayloadRelativePath(installed.platform, installed.sourceId, installed.id)) {
        throw new Error(`MCP package '${installed.id}' has an unexpected managed payload path and will not execute it.`);
      }
      await this.runMcpScript(installed.managedPayloadPath, mcpUninstallScript, "uninstall", installed.platform);
    }

    const existingContent = await this.readOptionalText("global", configPath);
    const nextContent = installed.platform === "codex"
      ? removeCodexMcpServer(existingContent, installed.id)
      : removeJsonMcpServer(existingContent, installed.id, managedMcpConfig(installed)?.serverConfig);
    if (nextContent !== undefined && nextContent !== existingContent) {
      await this.writeText("global", configPath, nextContent);
    }
    await this.stateStore("global").remove(installed.id, installed.platform, "global", installed.sourceId);
    if (installed.managedPayloadPath) await this.storage.remove("global", installed.managedPayloadPath);
  }

  private async prepareMcpPayload(
    pkg: MarketplacePackage,
    platform: Platform,
    files: readonly PackageFile[],
    action: Exclude<McpScriptAction, "uninstall">,
    existingOwnerPath?: string
  ): Promise<PreparedMcpPayload> {
    const path = mcpPayloadRelativePath(platform, pkg.source.id, pkg.manifest.id);
    const backupPath = `${path}.backup-${randomUUID()}`;
    const hadPrevious = await this.storage.exists("global", path);
    if (hadPrevious && existingOwnerPath !== path) {
      throw new Error(`Managed MCP payload path '${path}' already exists without matching installed ownership.`);
    }
    if (hadPrevious) await this.storage.move("global", path, backupPath);
    try {
      await this.replaceDirectory("global", path, files);
      await this.runMcpScript(path, mcpInstallScript, action, platform);
      return { path, ...(hadPrevious ? { backupPath } : {}) };
    } catch (error) {
      await this.storage.remove("global", path).catch(() => undefined);
      if (hadPrevious && await this.storage.exists("global", backupPath)) {
        await this.storage.move("global", backupPath, path).catch(() => undefined);
      }
      throw error;
    }
  }

  private async commitMcpPayload(prepared: PreparedMcpPayload): Promise<void> {
    if (prepared.backupPath) await this.storage.remove("global", prepared.backupPath).catch(() => undefined);
  }

  private async rollbackMcpPayload(prepared: PreparedMcpPayload): Promise<void> {
    await this.storage.remove("global", prepared.path);
    if (prepared.backupPath && await this.storage.exists("global", prepared.backupPath)) {
      await this.storage.move("global", prepared.backupPath, prepared.path);
    }
  }

  private async runMcpScript(
    packagePath: string,
    script: "install.py" | "uninstall.py",
    action: McpScriptAction,
    platform: Platform
  ): Promise<void> {
    if (!this.mcpScriptRunner) throw new Error("This host cannot execute MCP package lifecycle scripts.");
    await this.mcpScriptRunner.run({ scope: "global", packagePath, script, action, platform, timeoutMs: mcpScriptTimeoutMs });
  }

  private async removeLegacyMcpInstallations(id: string, platform: Platform, configPath: string): Promise<void> {
    for (const scope of ["workspace", "global"] as const) {
      const stateStore = this.stateStore(scope);
      const legacy = (await stateStore.read()).packages.filter((item) =>
        item.id === id
        && item.type === "mcp"
        && item.platform === platform
        && item.installedPath !== configPath
      );
      for (const installed of legacy) {
        for (const path of uninstallTargetPaths(installed, this.config)) {
          await this.deleteRelativeDirectory(scope, path);
        }
        await stateStore.removeInstalled(installed);
      }
    }
  }

  private async installClaudeHook(
    pkg: MarketplacePackage,
    scope: InstallScope,
    installedAt = new Date().toISOString(),
    previous?: InstalledPackage,
    persistState = true
  ): Promise<InstalledPackage> {
    const files = await this.fetchFiles(pkg);
    const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
    if (!entrypoint) {
      throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
    }
    const contribution = readClaudeHookConfig(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint);
    const installPath = installRelativePath("claude", "hook", pkg.manifest.id, this.config.platformPathOverrides);
    await this.assertNoInstallCollision(pkg, "claude", scope, installPath);
    await this.replacePackage(scope, installPath, files, pkg, "claude");
    const settingsPath = ".claude/settings.json";
    const settings = await this.readOptionalText(scope, settingsPath);
    if (previous?.managedConfig?.kind === "hook") {
      const withoutPrevious = removeClaudeHookConfig(settings, previous.managedConfig.hooks);
      await this.writeText(scope, settingsPath, upsertClaudeHookConfig(withoutPrevious, contribution));
    } else {
      await this.writeText(scope, settingsPath, upsertClaudeHookConfig(settings, contribution));
    }
    const installed: InstalledPackage = {
      id: pkg.manifest.id,
      type: "hook",
      platform: "claude",
      scope,
      version: pkg.manifest.version,
      sourceRepo: sourceRepository(pkg),
      sourceBranch: pkg.source.branch,
      sourcePath: pkg.sourcePath,
      ...sourceMetadata(pkg),
      managedConfig: { kind: "hook", hooks: contribution },
      installedPath: installPath,
      installedAt
    };
    if (persistState) {
      await this.stateStore(scope).upsert(installed);
    }
    return installed;
  }

  private async updateOffloadedClaudeHook(pkg: MarketplacePackage, installed: InstalledPackage): Promise<InstalledPackage> {
    const files = await this.fetchFiles(pkg);
    const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
    if (!entrypoint) {
      throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
    }
    const contribution = readClaudeHookConfig(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint);
    await this.replacePackage(installed.scope, installed.installedPath, files, pkg, "claude");
    return {
      ...installed,
      version: pkg.manifest.version,
      sourceRepo: sourceRepository(pkg),
      sourceBranch: pkg.source.branch,
      sourcePath: pkg.sourcePath,
      ...sourceMetadata(pkg),
      managedConfig: { kind: "hook", hooks: contribution }
    };
  }

  private async uninstallClaudeHook(installed: InstalledPackage): Promise<void> {
    await this.removeClaudeHookContribution(installed);
    for (const target of uninstallTargetPaths(installed, this.config)) {
      await this.deleteRelativeDirectory(installed.scope, target);
    }
    await this.stateStore(installed.scope).remove(installed.id, installed.platform, installed.scope, installed.sourceId);
  }

  private async removeClaudeHookContribution(installed: InstalledPackage): Promise<void> {
    if (installed.managedConfig?.kind !== "hook") {
      throw new Error(`Claude hook '${installed.id}' has no tracked settings contribution and will not be removed.`);
    }
    const settingsPath = ".claude/settings.json";
    const existing = await this.readOptionalText(installed.scope, settingsPath);
    const next = removeClaudeHookConfig(existing, installed.managedConfig.hooks);
    if (next !== undefined && next !== existing) {
      await this.writeText(installed.scope, settingsPath, next);
    }
  }

  private async restoreClaudeHookContribution(installed: InstalledPackage): Promise<void> {
    if (installed.managedConfig?.kind !== "hook") {
      throw new Error(`Claude hook '${installed.id}' has no tracked settings contribution and cannot be hotloaded.`);
    }
    const settingsPath = ".claude/settings.json";
    const existing = await this.readOptionalText(installed.scope, settingsPath);
    await this.writeText(installed.scope, settingsPath, upsertClaudeHookConfig(existing, installed.managedConfig.hooks));
  }

  private async replacePackage(
    scope: InstallScope,
    installPath: string,
    files: readonly PackageFile[],
    pkg: MarketplacePackage,
    platform: Platform
  ): Promise<void> {
    const payloadFiles = files.filter((file) => !isRootManifestFile(file.relativePath));
    const codexAgent = codexAgentContribution(pkg, platform, files, this.config);
    if (codexAgent) {
      const entrypoint = payloadFiles.find((file) => file.relativePath === pkg.manifest.entrypoint)!;
      await this.replaceDirectory(scope, installPath, payloadFiles);
      const activePath = installRelativePath(platform, pkg.manifest.type, pkg.manifest.id, this.config.platformPathOverrides);
      if (installPath === activePath) await this.storage.writeFileAtomic(scope, codexAgent.configPath, entrypoint.content);
      return;
    }
    if (platform !== "claude" || !isClaudeFlatFilePackage(pkg)) {
      await this.replaceDirectory(scope, installPath, payloadFiles);
      return;
    }
    const entrypoint = payloadFiles.find((file) => file.relativePath === pkg.manifest.entrypoint);
    if (!entrypoint) {
      throw new Error(`Claude package '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
    }
    if (payloadFiles.some((file) => file !== entrypoint)) {
      throw new Error(`Claude ${pkg.manifest.type} package '${pkg.manifest.id}' must contain only its Markdown entrypoint.`);
    }
    await this.deleteRelativeDirectory(scope, installPath);
    await this.storage.writeFile(scope, installPath, entrypoint.content);
  }

  private async assertCodexAgentConfigAvailable(
    pkg: MarketplacePackage,
    scope: InstallScope,
    installPath: string,
    contribution: ManagedConfigContribution | undefined,
    knownOwner?: InstalledPackage
  ): Promise<void> {
    if (contribution?.kind !== "codex-agent" || !await this.storage.exists(scope, contribution.configPath)) return;
    const owner = knownOwner ?? (await this.listInstalled()).find((item) =>
      item.type === "agent"
      && item.platform === "codex"
      && item.scope === scope
      && item.installedPath === installPath
      && item.sourceId === pkg.source.id
      && (item.qualifiedName ?? item.id) === pkg.manifest.qualifiedName
    );
    if (owner?.managedConfig?.kind !== "codex-agent") {
      throw new Error(`Codex agent config '${contribution.configPath}' already exists without matching installed ownership.`);
    }
    await this.assertManagedCodexAgentConfigUnmodified(owner);
  }

  private async assertManagedCodexAgentConfigUnmodified(installed: InstalledPackage): Promise<void> {
    const managed = installed.managedConfig;
    if (managed?.kind !== "codex-agent") return;
    const expectedPath = codexAgentConfigRelativePath(installed.id, this.config.platformPathOverrides);
    if (installed.platform !== "codex" || installed.type !== "agent" || managed.configPath !== expectedPath
      || !/^[0-9a-f]{64}$/.test(managed.contentSha256)) {
      throw new Error(`Codex agent '${installed.id}' has invalid managed config ownership metadata.`);
    }
    const content = await this.storage.readFile(installed.scope, managed.configPath);
    if (content === undefined) return;
    if (sha256(content) !== managed.contentSha256) {
      throw new Error(`Codex agent config '${managed.configPath}' was modified after installation; refusing to overwrite or remove it.`);
    }
  }

  private async materializeCodexAgentConfig(
    scope: InstallScope,
    activePath: string,
    packageId: string,
    managed: Extract<ManagedConfigContribution, { readonly kind: "codex-agent" }>
  ): Promise<void> {
    const content = await this.storage.readFile(scope, safeJoinRelative(activePath, `${packageId}.toml`));
    if (content === undefined || sha256(content) !== managed.contentSha256) {
      throw new Error(`Codex agent '${packageId}' managed payload does not match its recorded TOML config.`);
    }
    await this.storage.writeFileAtomic(scope, managed.configPath, content);
  }

  private async assertNoInstallCollision(
    pkg: MarketplacePackage,
    platform: Platform,
    scope: InstallScope,
    installPath: string
  ): Promise<void> {
    const collision = (await this.listInstalled()).find((item) =>
      item.platform === platform
      && item.scope === scope
      && item.installedPath === installPath
      && (item.sourceId !== pkg.source.id || (item.qualifiedName ?? item.id) !== pkg.manifest.qualifiedName)
    );
    if (collision) {
      throw new Error(`Install path '${installPath}' is already managed by '${collision.qualifiedName ?? collision.id}' from another source.`);
    }
  }

  private async assertMigrationDestinationAvailable(pkg: MarketplacePackage, predecessor: InstalledPackage, destination: string): Promise<void> {
    const state = await this.stateStore(predecessor.scope).read();
    const collision = state.packages.find((item) => item.platform === predecessor.platform && item.scope === predecessor.scope
      && item.sourceId === pkg.source.id && item.qualifiedName === pkg.manifest.qualifiedName);
    if (collision) throw new Error(`Destination package '${pkg.manifest.qualifiedName}' is already installed.`);
    const pathOwner = state.packages.find((item) => item.platform === predecessor.platform && item.installedPath === destination
      && !(item.id === predecessor.id && item.sourceId === predecessor.sourceId && item.qualifiedName === predecessor.qualifiedName
        && item.sourceRepo === predecessor.sourceRepo && item.sourceBranch === predecessor.sourceBranch && item.sourcePath === predecessor.sourcePath));
    if (pathOwner) throw new Error(`Managed destination '${destination}' is already owned by '${pathOwner.sourceId ?? "legacy"}:${pathOwner.qualifiedName ?? pathOwner.id}'.`);
    if (destination !== predecessor.installedPath && !pathOwner && await this.storage.exists(predecessor.scope, destination)) {
      throw new Error(`Managed destination '${destination}' already exists without marketplace ownership.`);
    }
  }

  private migratedRecord(pkg: MarketplacePackage, predecessor: InstalledPackage, installedPath: string, migratedAt: string, files: readonly PackageFile[]): InstalledPackage {
    const { revertedAt: _revertedAt, revertedFromVersion: _revertedFromVersion, managedConfig: _managedConfig, managedPayloadPath: _managedPayloadPath, sourceRevision: _sourceRevision, ...preserved } = predecessor;
    const managedConfig = pkg.manifest.type === "mcp"
      ? (() => { const config = readMcpHostConfig(pkg, predecessor.platform, files); return { kind: "mcp" as const, serverName: config.serverName, serverConfig: config.serverConfig }; })()
      : pkg.manifest.type === "hook" && predecessor.platform === "claude"
        ? (() => { const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint); if (!entrypoint) throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`); return { kind: "hook" as const, hooks: readClaudeHookConfig(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint) }; })()
        : undefined;
    return {
      ...preserved,
      id: pkg.manifest.id,
      version: pkg.manifest.version,
      sourceRepo: sourceRepository(pkg),
      sourceBranch: pkg.source.branch,
      sourcePath: pkg.sourcePath,
      ...(pkg.sourceRevision ? { sourceRevision: pkg.sourceRevision } : {}),
      ...sourceMetadata(pkg),
      installedPath,
      ...(pkg.manifest.type === "mcp" ? { managedPayloadPath: mcpPayloadRelativePath(predecessor.platform, pkg.source.id, pkg.manifest.id) } : {}),
      ...(managedConfig === undefined ? {} : { managedConfig }),
      migrationHistory: [...(predecessor.migrationHistory ?? []), { migratedAt, from: migrationSnapshot(predecessor), to: migrationSnapshotForPackage(pkg) }]
    };
  }

  private migratedMcpConfig(pkg: MarketplacePackage, predecessor: InstalledPackage, files: readonly PackageFile[], existing: string | undefined): string {
    const previous = managedMcpConfig(predecessor);
    if (!previous) throw new Error(`MCP package '${predecessor.id}' has no tracked configuration contribution and cannot be migrated safely.`);
    const next = readMcpHostConfig(pkg, predecessor.platform, files);
    const removed = predecessor.platform === "codex"
      ? removeCodexMcpServer(existing, previous.serverName, previous.serverConfig)
      : removeJsonMcpServer(existing, previous.serverName, previous.serverConfig);
    return predecessor.platform === "codex"
      ? upsertCodexMcpServer(removed, next.serverName, next.serverConfig)
      : upsertJsonMcpServer(removed, next.serverName, next.serverConfig);
  }

  private migratedClaudeHookConfig(pkg: MarketplacePackage, predecessor: InstalledPackage, files: readonly PackageFile[], existing: string | undefined): string {
    const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
    if (!entrypoint) throw new Error(`Claude hook '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
    const previous = predecessor.managedConfig?.kind === "hook" ? predecessor.managedConfig : undefined;
    if (!previous) throw new Error(`Claude hook '${predecessor.id}' has no tracked settings contribution and cannot be migrated safely.`);
    const removed = removeClaudeHookConfig(existing, previous.hooks);
    return upsertClaudeHookConfig(removed, readClaudeHookConfig(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.entrypoint));
  }

  private async rollbackMigration(journal: MigrationJournal): Promise<void> {
    const scope = journal.previous.scope;
    const state = await this.stateStore(scope).read();
    const committed = state.packages.some((item) => item.id === journal.next.id && item.platform === journal.next.platform && item.scope === journal.next.scope && item.sourceId === journal.next.sourceId);
    if (committed) {
      await this.storage.remove(scope, `.ai_marketplace/migrations/${journal.operationId}`);
      await this.storage.remove(scope, migrationJournalPath());
      return;
    }
    if (journal.targetPath !== journal.previous.installedPath) await this.storage.remove(scope, journal.targetPath);
    if (journal.payloadBackup && await this.storage.exists(scope, journal.payloadBackup)) {
      await this.storage.remove(scope, journal.previous.installedPath);
      await this.storage.move(scope, journal.payloadBackup, journal.previous.installedPath);
    }
    if (journal.configPath && journal.configBackup && await this.storage.exists(scope, journal.configBackup)) {
      await this.storage.remove(scope, journal.configPath);
      await this.storage.move(scope, journal.configBackup, journal.configPath);
    }
    await this.storage.remove(scope, `.ai_marketplace/migrations/${journal.operationId}`);
    await this.storage.remove(scope, migrationJournalPath());
  }

  private async recoverMigration(scope: InstallScope): Promise<void> {
    const content = await this.readOptionalText(scope, migrationJournalPath());
    if (!content) return;
    const parsed = this.validateMigrationJournal(JSON.parse(content) as unknown, scope);
    await this.rollbackMigration(parsed);
  }

  private validateMigrationJournal(value: unknown, scope: InstallScope): MigrationJournal {
    if (!isRecord(value) || typeof value.operationId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.operationId)
      || !isRecord(value.previous) || !isRecord(value.next) || typeof value.targetPath !== "string") {
      throw new Error("Migration recovery journal is malformed.");
    }
    const previous = value.previous as unknown as MigrationJournal["previous"];
    const next = value.next as unknown as MigrationJournal["next"];
    if (!isMigrationJournalPrevious(previous) || !isMigrationJournalNext(next)
      || previous.scope !== scope || next.scope !== scope || previous.platform !== next.platform) {
      throw new Error("Migration recovery journal has incompatible identities or scope.");
    }
    if (!isCanonicalInstalledPath(previous as InstalledPackage, this.config)) throw new Error("Migration recovery journal contains an unexpected predecessor path.");
    const expectedTarget = previous.type === "mcp" ? previous.installedPath
      : previous.scope === "cloud" ? cloudInstallPath(previous.platform, previous.type, next.id)
        : previous.installedPath.startsWith(".offload/") ? offloadRelativePath(previous.platform, previous.type, next.id)
          : installRelativePath(previous.platform, previous.type, next.id, this.config.platformPathOverrides);
    const backupRoot = `.ai_marketplace/migrations/${value.operationId}`;
    const expectedPayloadBackup = previous.scope === "cloud" || previous.type === "mcp" ? undefined : `${backupRoot}/payload`;
    const expectedConfigPath = migrationConfigPath(previous as InstalledPackage);
    const expectedConfigBackup = expectedConfigPath ? `${backupRoot}/config` : undefined;
    if (value.targetPath !== expectedTarget || value.payloadBackup !== expectedPayloadBackup
      || value.configPath !== expectedConfigPath || value.configBackup !== expectedConfigBackup) {
      throw new Error("Migration recovery journal contains unexpected managed paths.");
    }
    return value as unknown as MigrationJournal;
  }

  private assertCompatibleRollback(pkg: MarketplacePackage, installed: InstalledPackage): void {
    if (sourceRepository(pkg) !== installed.sourceRepo
      || pkg.source.branch !== installed.sourceBranch
      || (installed.sourceId !== undefined && pkg.source.id !== installed.sourceId)
      || pkg.sourcePath !== installed.sourcePath
      || pkg.manifest.id !== installed.id
      || pkg.manifest.qualifiedName !== (installed.qualifiedName ?? installed.id)
      || pkg.manifest.type !== installed.type
      || !pkg.manifest.platforms.includes(installed.platform)
      || !pkg.manifest.delivery.includes(installed.scope)
      || !isCanonicalInstalledPath(installed, this.config)) {
      throw new Error("Rollback snapshot is not compatible with the installed package source, identity, platform, or scope.");
    }
  }

  private async assertNoMcpCollision(pkg: MarketplacePackage, platform: Platform, previous?: InstalledPackage): Promise<void> {
    const collision = (await this.listInstalled()).find((item) =>
      item.type === "mcp"
      && item.platform === platform
      && item.id === pkg.manifest.id
      && (item.sourceId !== undefined || item.installedPath === mcpConfigRelativePath(platform))
      && !sameInstalledRecord(item, previous)
      && (item.sourceId !== pkg.source.id || (item.qualifiedName ?? item.id) !== pkg.manifest.qualifiedName)
    );
    if (collision) {
      throw new Error(`MCP server '${pkg.manifest.id}' is already managed by another package source.`);
    }
  }

  private async replaceDirectory(scope: InstallScope, relativeDirectory: string, files: readonly PackageFile[]): Promise<void> {
    await this.storage.replaceDirectory(scope, relativeDirectory, files.map((file) => ({
      relativePath: safeJoinRelative(file.relativePath),
      content: file.content
    })));
  }

  private async moveDirectory(scope: InstallScope, fromRelativePath: string, toRelativePath: string): Promise<void> {
    await this.storage.move(scope, fromRelativePath, toRelativePath);
  }

  private async deleteRelativeDirectory(scope: InstallScope, relativeDirectory: string): Promise<void> {
    await this.storage.remove(scope, relativeDirectory);
  }

  private async readOptionalText(scope: InstallScope, relativePath: string): Promise<string | undefined> {
    const bytes = await this.storage.readFile(scope, relativePath);
    return bytes === undefined ? undefined : Buffer.from(bytes).toString("utf8");
  }

  private async writeText(scope: InstallScope, relativePath: string, content: string): Promise<void> {
    await this.storage.writeFileAtomic(scope, relativePath, Buffer.from(content, "utf8"));
  }
}

function sameInstalledRecord(left: InstalledPackage, right: InstalledPackage | undefined): boolean {
  return right !== undefined
    && left.id === right.id
    && left.platform === right.platform
    && left.scope === right.scope
    && left.installedAt === right.installedAt
    && left.installedPath === right.installedPath;
}

function isClaudeFlatFilePackage(pkg: MarketplacePackage): boolean {
  return pkg.manifest.type === "command" || pkg.manifest.type === "agent" || pkg.manifest.type === "rule";
}

function codexAgentContribution(
  pkg: MarketplacePackage,
  platform: Platform,
  files: readonly PackageFile[],
  config: MarketplaceConfig
): Extract<ManagedConfigContribution, { readonly kind: "codex-agent" }> | undefined {
  if (platform !== "codex" || pkg.manifest.type !== "agent") return undefined;
  const expectedEntrypoint = `${pkg.manifest.id}.toml`;
  if (pkg.manifest.entrypoint !== expectedEntrypoint) {
    throw new Error(`Codex agent '${pkg.manifest.id}' entrypoint must be '${expectedEntrypoint}'.`);
  }
  const entrypoint = files.find((file) => file.relativePath === expectedEntrypoint);
  if (!entrypoint) throw new Error(`Codex agent '${pkg.manifest.id}' is missing entrypoint '${expectedEntrypoint}'.`);
  return {
    kind: "codex-agent",
    configPath: codexAgentConfigRelativePath(pkg.manifest.id, config.platformPathOverrides),
    contentSha256: sha256(entrypoint.content)
  };
}

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function isOffloaded(installed: InstalledPackage): boolean {
  return installed.installedPath === offloadRelativePath(installed.platform, installed.type, installed.id);
}

function isCanonicalInstalledPath(installed: InstalledPackage, config: MarketplaceConfig): boolean {
  if (installed.type === "mcp") {
    return installed.scope === "global"
      && installed.installedPath === mcpConfigRelativePath(installed.platform)
      && (installed.managedPayloadPath === undefined
        || (installed.sourceId !== undefined && installed.managedPayloadPath === mcpPayloadRelativePath(installed.platform, installed.sourceId, installed.id)));
  }
  if (installed.scope === "cloud") {
    return installed.installedPath === cloudInstallPath(installed.platform, installed.type, installed.id);
  }
  if (installed.scope !== "workspace" && installed.scope !== "global") {
    return false;
  }
  return installed.installedPath === installRelativePath(installed.platform, installed.type, installed.id, config.platformPathOverrides)
    || isOffloaded(installed);
}

function managedMcpConfig(installed: InstalledPackage | undefined): Extract<ManagedConfigContribution, { readonly kind: "mcp" }> | undefined {
  return installed?.managedConfig?.kind === "mcp" ? installed.managedConfig : undefined;
}

function sourceRepository(pkg: MarketplacePackage): string {
  return repositoryIdentity(pkg.source);
}

function sourceMetadata(pkg: MarketplacePackage): Pick<InstalledPackage, "sourceId" | "qualifiedName" | "group" | "sourceRevision"> {
  return {
    sourceId: pkg.source.id,
    qualifiedName: pkg.manifest.qualifiedName,
    group: pkg.manifest.group,
    sourceRevision: pkg.sourceRevision
  };
}

interface MigrationJournal {
  readonly operationId: string;
  readonly previous: Pick<InstalledPackage, "id" | "qualifiedName" | "sourceId" | "sourceRepo" | "sourceBranch" | "sourcePath" | "type" | "platform" | "scope" | "installedPath">;
  readonly next: Pick<InstalledPackage, "id" | "sourceId" | "platform" | "scope">;
  readonly targetPath: string;
  readonly payloadBackup?: string;
  readonly configPath?: string;
  readonly configBackup?: string;
}

interface PreparedMcpPayload {
  readonly path: string;
  readonly backupPath?: string;
}

function migrationJournalPrevious(installed: InstalledPackage): MigrationJournal["previous"] {
  return { id: installed.id, ...(installed.qualifiedName === undefined ? {} : { qualifiedName: installed.qualifiedName }), ...(installed.sourceId === undefined ? {} : { sourceId: installed.sourceId }), sourceRepo: installed.sourceRepo, sourceBranch: installed.sourceBranch, sourcePath: installed.sourcePath, type: installed.type, platform: installed.platform, scope: installed.scope, installedPath: installed.installedPath };
}

function migrationJournalNext(installed: InstalledPackage): MigrationJournal["next"] {
  return { id: installed.id, ...(installed.sourceId === undefined ? {} : { sourceId: installed.sourceId }), platform: installed.platform, scope: installed.scope };
}

function isMigrationJournalPrevious(value: MigrationJournal["previous"]): boolean {
  return typeof value.id === "string" && typeof value.sourceRepo === "string" && typeof value.sourceBranch === "string" && typeof value.sourcePath === "string" && typeof value.type === "string" && typeof value.platform === "string" && typeof value.scope === "string" && typeof value.installedPath === "string" && (value.qualifiedName === undefined || typeof value.qualifiedName === "string") && (value.sourceId === undefined || typeof value.sourceId === "string");
}

function isMigrationJournalNext(value: MigrationJournal["next"]): boolean {
  return typeof value.id === "string" && typeof value.platform === "string" && typeof value.scope === "string" && (value.sourceId === undefined || typeof value.sourceId === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function migrationJournalPath(): string { return ".ai_marketplace/migration-journal.json"; }
function migrationConfigPath(installed: InstalledPackage): string | undefined {
  if (installed.type === "mcp") return mcpConfigRelativePath(installed.platform);
  return installed.type === "hook" && installed.platform === "claude" ? ".claude/settings.json" : undefined;
}
function migrationSnapshot(installed: InstalledPackage): PackageMigrationSnapshot {
  return { id: installed.id, qualifiedName: installed.qualifiedName ?? installed.id, ...(installed.sourceId === undefined ? {} : { sourceId: installed.sourceId }), version: installed.version, repository: installed.sourceRepo, branch: installed.sourceBranch, path: installed.sourcePath };
}
function migrationSnapshotForPackage(pkg: MarketplacePackage): PackageMigrationSnapshot {
  return { id: pkg.manifest.id, qualifiedName: pkg.manifest.qualifiedName, sourceId: pkg.source.id, version: pkg.manifest.version, repository: sourceRepository(pkg), branch: pkg.source.branch, path: pkg.sourcePath };
}
