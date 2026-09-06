import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import { RepositoryClient } from "./services/repositoryClient";
import { PackageInstaller } from "./services/packageInstaller";
import {
  readEditableRepositorySettings, readMarketplaceConfig, readUserAutomationPreferences, tryReadMarketplaceConfig,
  writeUserAutoInstallGroups, writeUserAutoUpdate, writeUserRepositorySettings,
  type EditableRepositorySetting
} from "./services/configuration";
import { InstalledStateStore } from "./services/installedState";
import { getWorkspaceRoot } from "./services/pathSafety";
import { compareVersions, isUpdateAvailable } from "./services/versioning";
import { eligibleInstallPlatforms, installOptionsForPackage, installedIdentity, mcpInstallPlatformCandidates, packageIdentity } from "./services/marketplaceModel";
import { availableBulkInstallScopes, availableBulkUninstallScopes, matchingUninstallTargets, planBulkInstall, planBulkUninstall, type BulkPackageSelection } from "./services/bulkPlanning";
import { mcpConfigRelativePath } from "./services/mcpConfig";
import { defaultPackageInstallPlans } from "./services/defaultPackages";
import { autoInstallGroupPlans, collectPackageGroups, planGroupInstall, type GroupInstallScope } from "./services/groupInstall";
import { discoverInstalledPackages, type AutoDiscoveryDirectoryEntry, type AutoDiscoveryFileSystem } from "./services/autoDiscovery";
import { type InstallScope, type InstalledPackage, type MarketplaceAction, type MarketplacePackage, platforms, type Platform } from "./types/packages";
import { MarketplaceWebview, type BulkPackageAction, type PackageActionOptions } from "./ui/marketplaceWebview";
import { cloudInstallPath, installRelativePath, offloadRelativePath, planPackageMigrations, repositoryIdentity, repositoryProviders, type RepositoryConfig, type RepositoryCredentialKind, type RepositoryProvider } from "@ai-marketplace/core";
import { createVscodeCredentialProvider, storeRepositoryCredential } from "./services/repositoryCredentials";

const lastSeenVersionKey = "aiMarketplace.lastSeenVersion";
const changelogSeenVersionKeyPrefix = "aiMarketplace.changelogSeen.";

let catalogCache: readonly MarketplacePackage[] = [];
let webview: MarketplaceWebview | undefined;
let output: vscode.OutputChannel;
let extensionVersion = "0.0.0";

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("AI Marketplace");
  context.subscriptions.push(output);
  extensionVersion = currentExtensionVersion(context);

  webview = new MarketplaceWebview(
    context.extensionUri,
    (action, packageId, options) => runAction(context, action, packageId, options),
    (actions) => runBulkActions(context, actions),
    () => refresh(context, true),
    () => setRepositoryCredential(context),
    () => toggleGlobalAutoUpdate(context),
    () => installPackageByGroup(context),
    (groups) => setAutoInstallGroups(groups),
    (originalId, repository) => saveRepository(context, originalId, repository),
    (repositoryId) => removeRepository(context, repositoryId)
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("aiMarketplace.marketplaceView", webview, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand("aiMarketplace.open", () => openMarketplace(context)),
    vscode.commands.registerCommand("aiMarketplace.refresh", () => refresh(context, true)),
    vscode.commands.registerCommand("aiMarketplace.diagnoseConnection", () => diagnoseConnection(context)),
    vscode.commands.registerCommand("aiMarketplace.setRepositoryCredential", () => setRepositoryCredential(context)),
    vscode.commands.registerCommand("aiMarketplace.setGitHubToken", () => setRepositoryCredential(context, "github")),
    vscode.commands.registerCommand("aiMarketplace.installPackage", () => pickAndRun(context, "install")),
    vscode.commands.registerCommand("aiMarketplace.installPackageByGroup", () => installPackageByGroup(context)),
    vscode.commands.registerCommand("aiMarketplace.configureAutoInstallGroups", () => configureAutoInstallGroups()),
    vscode.commands.registerCommand("aiMarketplace.uninstallPackage", () => pickAndRun(context, "uninstall")),
    vscode.commands.registerCommand("aiMarketplace.updatePackage", () => pickAndRun(context, "update")),
    vscode.commands.registerCommand("aiMarketplace.migratePackage", () => pickAndRun(context, "migrate")),
    vscode.commands.registerCommand("aiMarketplace.revertPackage", () => pickAndRun(context, "revert")),
    vscode.commands.registerCommand("aiMarketplace.hotloadPackage", () => pickAndRun(context, "hotload")),
    vscode.commands.registerCommand("aiMarketplace.offloadPackage", () => pickAndRun(context, "offload"))
  );

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    void new InstalledStateStore(workspaceFolder.uri).discardLegacyAutomationPreferences()
      .catch((error) => log(`Unable to remove legacy workspace automation preferences: ${error instanceof Error ? error.message : String(error)}`));
  }
  void updateWebview();
  if (tryReadMarketplaceConfig()) {
    void refresh(context, false);
  }
  void showChangelogAfterUpdate(context);
}

export function deactivate(): void {
  // Nothing to dispose beyond registered subscriptions.
}

async function openMarketplace(context: vscode.ExtensionContext): Promise<void> {
  webview?.revealPanel(await buildMarketplaceModel());
  if (catalogCache.length === 0 && tryReadMarketplaceConfig()) {
    await refresh(context, false);
  }
  webview?.revealPanel(await buildMarketplaceModel());
}

async function refresh(context: vscode.ExtensionContext, showResult: boolean): Promise<void> {
  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Refreshing AI Marketplace", cancellable: false },
      async (progress) => {
        const config = readMarketplaceConfig();
        const client = createRepositoryClient(context, config);
        let publication = Promise.resolve();
        catalogCache = await client.listMarketplacePackages((sourceProgress) => {
          catalogCache = sourceProgress.catalog;
          progress.report({ message: `Loaded ${sourceProgress.packages.length} package(s) from ${sourceProgress.source.label}` });
          publication = publication.then(() => updateWebview());
          return publication;
        });
        await publication;
        const discovered = await applyAutoDiscovery(config);
        const defaultInstalled = await applyDefaultPackageInstalls(config, client);
        const groupInstalled = await applyAutoInstallGroups(config, client);
        const autoUpdated = await applyAutoUpdates(config, client);
        if (showResult) {
          const discoverySuffix = discovered > 0 ? ` Discovered ${discovered} existing package(s).` : "";
          const defaultSuffix = defaultInstalled > 0 ? ` Installed ${defaultInstalled} default package(s).` : "";
          const groupSuffix = groupInstalled > 0 ? ` Installed ${groupInstalled} package(s) from automatic groups.` : "";
          const updateSuffix = autoUpdated > 0 ? ` Auto-updated ${autoUpdated} package(s).` : "";
          const suffix = `${discoverySuffix}${defaultSuffix}${groupSuffix}${updateSuffix}`;
          void vscode.window.showInformationMessage(`AI Marketplace refreshed ${catalogCache.length} package(s).${suffix}`);
        }
      }
    );
    await updateWebview();
  } catch (error) {
    await reportError("AI Marketplace refresh failed", error);
    await updateWebview();
  }
}

async function diagnoseConnection(context: vscode.ExtensionContext): Promise<void> {
  try {
    const config = readMarketplaceConfig();
    const client = createRepositoryClient(context, config);
    await client.checkConnection();
    const branches = await client.listBranches();
    const packages = await client.listMarketplacePackages();
    log(`Connection OK. Available branches: ${branches.join(", ") || "<none returned>"}`);
    log(`Connection OK. Catalog probe found ${packages.length} package(s).`);
    void vscode.window.showInformationMessage(`AI Marketplace connected to ${config.repository}. Catalog probe found ${packages.length} package(s).`);
  } catch (error) {
    await reportError("AI Marketplace connection failed", error);
  }
}

async function setRepositoryCredential(context: vscode.ExtensionContext, providerFilter?: "github"): Promise<void> {
  const config = tryReadMarketplaceConfig();
  const sources = (config?.repositories ?? []).filter((source) => !providerFilter || source.provider === providerFilter);
  const providers: readonly RepositoryProvider[] = providerFilter ? [providerFilter] : repositoryProviders;
  const targets: Array<vscode.QuickPickItem & { readonly provider: RepositoryProvider; readonly source?: RepositoryConfig }> = [
    ...providers.map((provider) => ({ label: `Shared ${repositoryProviderLabel(provider)} credential`, description: `Used for all ${repositoryProviderLabel(provider)} repositories.`, provider })),
    ...sources.map((source) => ({ label: `Credential for ${source.label}`, description: `${repositoryProviderLabel(source.provider)}; used only after shared authentication fails for ${source.repository}.`, provider: source.provider, source }))
  ];
  const target = await vscode.window.showQuickPick(targets, { title: "Save repository credential", placeHolder: "Choose a provider or repository-specific credential" });
  if (!target) {
    return;
  }
  const kinds: Array<vscode.QuickPickItem & { readonly credentialKind: RepositoryCredentialKind }> = target.provider === "azure-devops"
    ? [{ label: "Microsoft Entra / OAuth token", credentialKind: "bearer" }, { label: "Azure DevOps PAT", credentialKind: "basic-pat" }]
    : target.provider === "gitlab"
      ? [{ label: "GitLab OAuth token", credentialKind: "bearer" }, { label: "GitLab access token", credentialKind: "private-token" }]
      : [{ label: "GitHub token", credentialKind: "bearer" }];
  const method = kinds.length === 1 ? kinds[0] : await vscode.window.showQuickPick(kinds, { title: "Choose credential type" });
  if (!method) return;
  const value = await vscode.window.showInputBox({
    title: method.label,
    prompt: "Enter a credential with read access to the selected repository scope.",
    password: true,
    ignoreFocusOut: true,
    validateInput: (input) => input.trim().length === 0 ? "Token cannot be empty." : undefined
  });
  if (!value) {
    return;
  }
  await storeRepositoryCredential(context.secrets, target.provider, { kind: method.credentialKind, token: value.trim() }, target.source);
  void vscode.window.showInformationMessage(`${target.label} saved securely.`);
}

async function pickAndRun(context: vscode.ExtensionContext, action: MarketplaceAction): Promise<void> {
  if ((catalogCache.length === 0 || action === "update" || action === "revert") && action !== "uninstall" && action !== "hotload" && action !== "offload") {
    await refresh(context, false);
  }
  if (action === "uninstall" || action === "hotload" || action === "offload") {
    const installed = await pickInstalledPackage(action === "hotload" || action === "offload" ? action : undefined);
    if (!installed) {
      return;
    }
    await runAction(context, action, installed.id, {
      sourceId: installed.sourceId,
      qualifiedName: installed.qualifiedName,
      platform: installed.platform,
      scope: installed.scope
    });
    return;
  }
  const pkg = await pickPackage(action);
  if (!pkg) {
    return;
  }
  await runAction(context, action, pkg.manifest.id, {
    sourceId: pkg.source.id,
    qualifiedName: pkg.manifest.qualifiedName
  });
}

async function runAction(
  context: vscode.ExtensionContext,
  action: MarketplaceAction,
  packageId: string,
  options: PackageActionOptions = {}
): Promise<void> {
  try {
    const pkg = action === "migrate" && options.destinationSourceId && options.destinationQualifiedName
      ? catalogCache.find((candidate) => candidate.source.id === options.destinationSourceId && candidate.manifest.qualifiedName === options.destinationQualifiedName)
      : findCatalogPackage(packageId, options);
    if (!pkg && action !== "uninstall" && action !== "hotload" && action !== "offload") {
      throw new Error(`Package '${packageId}' is not loaded in the catalog.`);
    }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `AI Marketplace: ${action}`, cancellable: false },
      async () => {
        const config = readMarketplaceConfig();
        const workspaceRoot = getWorkspaceRoot();
        const client = createRepositoryClient(context, config);
        const installer = new PackageInstaller(
          workspaceRoot,
          config,
          async (selectedPackage) => client.fetchPackageFiles(selectedPackage)
        );

        switch (action) {
          case "install":
          case "installGlobal":
          case "installCloud":
          case "installDifferentPlatform":
            await installPackage(installer, requirePackage(pkg), config.defaultPlatform, action, options);
            break;
          case "update":
            await updatePackage(installer, requirePackage(pkg), options);
            break;
          case "migrate":
            await migratePackage(installer, requirePackage(pkg), config, options);
            break;
          case "revert":
            await revertPackage(installer, client, requirePackage(pkg), options);
            break;
          case "uninstall":
            await uninstallPackage(installer, packageId, options);
            break;
          case "offload":
            await movePackage(installer, packageId, pkg?.manifest.name ?? packageId, "offload", options);
            break;
          case "hotload":
            await movePackage(installer, packageId, pkg?.manifest.name ?? packageId, "hotload", options);
            break;
        }
      }
    );
    await updateWebview();
  } catch (error) {
    await reportError(`AI Marketplace ${action} failed`, error);
    await updateWebview();
  }
}

async function runBulkActions(context: vscode.ExtensionContext, actions: readonly BulkPackageAction[]): Promise<void> {
  const action = actions[0]?.action;
  if (!action || actions.some((item) => item.action !== action)) {
    await reportError("AI Marketplace bulk action failed", new Error("A bulk request must contain one action type."));
    return;
  }
  if (action === "install") {
    await runBulkInstall(context, actions);
    return;
  }
  if (action === "uninstall") {
    await runBulkUninstall(context, actions);
    return;
  }
  if (action === "migrate") {
    await runBulkMigrate(context, actions);
    return;
  }
  for (const item of actions) {
    await runAction(context, item.action, item.packageId, item);
  }
}

async function runBulkMigrate(context: vscode.ExtensionContext, actions: readonly BulkPackageAction[]): Promise<void> {
  try {
    const config = readMarketplaceConfig();
    const client = createRepositoryClient(context, config);
    const installer = new PackageInstaller(getWorkspaceRoot(), config, (pkg) => client.fetchPackageFiles(pkg));
    const eligible = planPackageMigrations(catalogCache, await installer.listInstalled()).eligible;
    const selected = actions.flatMap((action) => eligible.filter((candidate) =>
      candidate.destination.source.id === (action.destinationSourceId ?? action.sourceId)
      && candidate.destination.manifest.qualifiedName === (action.destinationQualifiedName ?? action.qualifiedName)
      && (!action.predecessorId || candidate.predecessor.id === action.predecessorId)
      && (!action.predecessorSourceId || candidate.predecessor.sourceId === action.predecessorSourceId)
      && (!action.platform || candidate.predecessor.platform === action.platform)
      && (!action.scope || candidate.predecessor.scope === action.scope)));
    const unique = [...new Map(selected.map((item) => [`${item.destination.source.id}:${item.destination.manifest.qualifiedName}:${item.predecessor.sourceId ?? "legacy"}:${item.predecessor.id}:${item.predecessor.platform}:${item.predecessor.scope}`, item])).values()];
    if (unique.length === 0) throw new Error("No selected package migration is eligible.");
    const scriptedCount = unique.filter((item) => item.destination.manifest.type === "mcp").length;
    const confirmation = await vscode.window.showWarningMessage(`Migrate ${unique.length} package installation(s)? Managed files and configuration will be replaced.${scriptedCount > 0 ? ` ${scriptedCount} MCP migration(s) execute uninstall.py and install.py with your user privileges.` : ""}`, { modal: true }, "Migrate");
    if (confirmation !== "Migrate") return;
    let succeeded = 0;
    let failed = 0;
    for (const candidate of unique) {
      try { await installer.migrateInstalled(candidate.destination, candidate.predecessor); succeeded += 1; }
      catch (error) { failed += 1; log(`Bulk migration failed for ${candidate.predecessor.id}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    await updateWebview();
    showBulkSummary("Migrated", succeeded, actions.length - unique.length, failed, unique[0].predecessor.scope);
  } catch (error) {
    await reportError("AI Marketplace bulk migration failed", error);
    await updateWebview();
  }
}

async function runBulkInstall(context: vscode.ExtensionContext, actions: readonly BulkPackageAction[]): Promise<void> {
  try {
    const config = readMarketplaceConfig();
    const workspaceRoot = getWorkspaceRoot();
    let client: RepositoryClient | undefined;
    const installer = new PackageInstaller(workspaceRoot, config, async (pkg) => {
      client ??= createRepositoryClient(context, config);
      return client.fetchPackageFiles(pkg);
    });
    const installed = await installer.listInstalled();
    const missing: BulkPackageSelection[] = [];
    const candidates = actions.flatMap((item) => {
      const pkg = findCatalogPackage(item.packageId, item);
      if (!pkg) {
        missing.push(toBulkSelection(item));
        return [];
      }
      return [{
        selection: toBulkSelection(item),
        pkg,
        options: installOptionsForPackage(pkg, installed.filter((candidate) => installedIdentity(candidate) === packageIdentity(pkg)), config.defaultPlatform)
      }];
    });
    const scopes = availableBulkInstallScopes(candidates);
    const scope = await pickScope("Install selected packages in", "Choose one destination for the selected packages", scopes);
    if (!scope) {
      return;
    }
    if (scope === "cloud") {
      throw new Error("Bulk package installation supports only workspace and user-directory targets.");
    }
    const plan = planBulkInstall(candidates, scope);
    const scripted = plan.eligible.flatMap((item) => {
      const candidate = candidates.find((entry) => entry.selection === item.selection);
      return candidate?.pkg.manifest.type === "mcp" ? [candidate.pkg] : [];
    });
    if (scripted.length > 0 && !await authorizeMcpScripts(scripted.map(packageScriptLabel), "install.py")) return;
    let succeeded = 0;
    let failed = 0;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Installing selected packages ${scopeMessage(scope)}`, cancellable: false },
      async () => {
        for (const item of plan.eligible) {
          const candidate = candidates.find((entry) => entry.selection === item.selection);
          if (!candidate) {
            failed += 1;
            continue;
          }
          try {
            await installer.install(candidate.pkg, item.option.platform, scope);
            succeeded += 1;
          } catch (error) {
            failed += 1;
            log(`Bulk install failed for ${candidate.pkg.manifest.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    );
    await updateWebview();
    showBulkSummary("Installed", succeeded, missing.length + plan.skipped.length, failed, scope);
  } catch (error) {
    await reportError("AI Marketplace bulk install failed", error);
    await updateWebview();
  }
}

async function runBulkUninstall(context: vscode.ExtensionContext, actions: readonly BulkPackageAction[]): Promise<void> {
  try {
    const config = readMarketplaceConfig();
    const workspaceRoot = getWorkspaceRoot();
    const installer = new PackageInstaller(workspaceRoot, config, async (pkg) => {
      const client = createRepositoryClient(context, config);
      return client.fetchPackageFiles(pkg);
    });
    const installed = await installer.listInstalled();
    const candidates = actions.map((item) => ({ selection: toBulkSelection(item), installed }));
    const scopes = availableBulkUninstallScopes(candidates);
    const scope = await pickScope("Uninstall selected packages from", "Choose one installation scope to remove", scopes);
    if (!scope) {
      return;
    }
    const plan = planBulkUninstall(candidates, scope);
    const scripted = plan.eligible.filter((item) => item.type === "mcp" && item.managedPayloadPath).map(installedScriptLabel);
    if (scripted.length > 0 && !await authorizeMcpScripts(scripted, "uninstall.py")) return;
    let succeeded = 0;
    let failed = 0;
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Uninstalling selected packages ${scopeMessage(scope)}`, cancellable: false },
      async () => {
        for (const target of plan.eligible) {
          try {
            await installer.uninstall(target);
            succeeded += 1;
          } catch (error) {
            failed += 1;
            log(`Bulk uninstall failed for ${target.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    );
    await updateWebview();
    showBulkSummary("Uninstalled", succeeded, plan.skipped.length, failed, scope);
  } catch (error) {
    await reportError("AI Marketplace bulk uninstall failed", error);
    await updateWebview();
  }
}

function toBulkSelection(item: BulkPackageAction): BulkPackageSelection {
  return {
    packageId: item.packageId,
    sourceId: item.sourceId,
    qualifiedName: item.qualifiedName,
    platform: item.platform
  };
}

async function pickScope(
  title: string,
  placeHolder: string,
  scopes: readonly InstallScope[]
): Promise<InstallScope | undefined> {
  if (scopes.length === 0) {
    void vscode.window.showWarningMessage("No selected packages support a compatible installation scope.");
    return undefined;
  }
  const picked = await vscode.window.showQuickPick(
    scopes.map((scope) => ({ label: scopeLabel(scope), description: scopeMessage(scope), scope })),
    { title, placeHolder }
  );
  return picked?.scope;
}

function showBulkSummary(verb: string, succeeded: number, skipped: number, failed: number, scope: InstallScope): void {
  const details = [`${verb} ${succeeded} package(s) ${scopeMessage(scope)}.`];
  if (skipped > 0) details.push(`Skipped ${skipped} package(s) without a matching target.`);
  if (failed > 0) details.push(`Failed ${failed} package(s); see AI Marketplace output for details.`);
  const message = details.join(" ");
  if (skipped > 0 || failed > 0) {
    void vscode.window.showWarningMessage(message);
    return;
  }
  void vscode.window.showInformationMessage(message);
}

async function installPackage(
  installer: PackageInstaller,
  pkg: MarketplacePackage,
  defaultPlatform: Platform,
  action: MarketplaceAction,
  options: { readonly platform?: Platform; readonly scope?: InstallScope }
): Promise<void> {
  const installed = await installer.listInstalled();
  const requestedScope = pkg.manifest.type === "mcp"
    ? "global"
    : options.scope ?? (action === "installGlobal" ? "global" : action === "installCloud" ? "cloud" : "workspace");
  const platform = action === "installDifferentPlatform"
    ? await pickInstallPlatform(pkg, installed, defaultPlatform, requestedScope, action)
    : options.platform ?? await pickInstallPlatform(pkg, installed, defaultPlatform, requestedScope, action);
  if (!platform || !pkg.manifest.platforms.includes(platform) || !pkg.manifest.delivery.includes(requestedScope)) {
    return;
  }
  if (pkg.manifest.type === "mcp" && !await authorizeMcpScripts([packageScriptLabel(pkg)], "install.py")) return;
  const result = await installer.install(pkg, platform, requestedScope);
  if (pkg.manifest.type === "mcp") {
    const fullPath = path.join(os.homedir(), ...result.installedPath.split("/"));
    log(`Installed and configured MCP package ${pkg.manifest.id} (${platform}) in ${fullPath}.`);
    void vscode.window.showInformationMessage(`Installed and configured ${pkg.manifest.name} for ${platform} in ${fullPath}.`);
    return;
  }
  void vscode.window.showInformationMessage(`Installed ${pkg.manifest.name} for ${platform} ${scopeMessage(requestedScope)}.`);
}

async function updatePackage(installer: PackageInstaller, pkg: MarketplacePackage, options: PackageActionOptions): Promise<void> {
  const installed = await pickInstalled(installer, pkg.manifest.id, "Update which installation?", undefined, options);
  if (!installed) {
    return;
  }
  if (!isUpdateAvailable(installed.version, pkg.manifest.version) && !(installed.autoUpdate === false && installed.revertedAt !== undefined)) {
    void vscode.window.showInformationMessage(`${pkg.manifest.name} is already up to date for ${installed.platform}.`);
    return;
  }
  if (pkg.manifest.type === "mcp" && !await authorizeMcpScripts([packageScriptLabel(pkg)], "install.py")) return;
  await installer.updateInstalled(pkg, installed);
  void vscode.window.showInformationMessage(`Updated ${pkg.manifest.name} from the configured branch for ${installed.platform} ${scopeMessage(installed.scope)}.`);
}

async function migratePackage(installer: PackageInstaller, destination: MarketplacePackage, config: ReturnType<typeof readMarketplaceConfig>, options: PackageActionOptions): Promise<void> {
  const candidates = planPackageMigrations(catalogCache, await installer.listInstalled()).eligible.filter((candidate) =>
    candidate.destination.source.id === destination.source.id
    && candidate.destination.manifest.qualifiedName === destination.manifest.qualifiedName
    && (!options.predecessorId || candidate.predecessor.id === options.predecessorId)
    && (!options.predecessorSourceId || candidate.predecessor.sourceId === options.predecessorSourceId)
    && (!options.predecessorQualifiedName || candidate.predecessor.qualifiedName === options.predecessorQualifiedName)
    && (!options.platform || candidate.predecessor.platform === options.platform)
    && (!options.scope || candidate.predecessor.scope === options.scope));
  let candidate: (typeof candidates)[number] | undefined = candidates[0];
  if (candidates.length > 1) {
    const picked = await vscode.window.showQuickPick(candidates.map((item) => ({ label: item.predecessor.qualifiedName ?? item.predecessor.id, description: `${item.predecessor.platform} - ${item.predecessor.scope} - ${item.predecessor.version}`, candidate: item })), { title: "Migrate which installation?" });
    candidate = picked?.candidate;
  }
  if (!candidate) throw new Error(`No eligible predecessor is installed for '${destination.manifest.name}'.`);
  const current = candidate.predecessor;
  const targetPath = current.type === "mcp" ? current.installedPath
    : current.scope === "cloud" ? cloudInstallPath(current.platform, current.type, destination.manifest.id)
      : current.installedPath.startsWith(".offload/") ? offloadRelativePath(current.platform, current.type, destination.manifest.id)
        : installRelativePath(current.platform, current.type, destination.manifest.id, config.platformPathOverrides);
  const scriptNotice = destination.manifest.type === "mcp" ? " This executes the predecessor uninstall.py (when cached) and destination install.py with your user privileges." : "";
  const confirmation = await vscode.window.showWarningMessage(`Migrate ${current.qualifiedName ?? current.id} ${current.version} from ${current.sourceRepo} to ${destination.manifest.qualifiedName} ${destination.manifest.version} in ${current.scope}? Managed files and configuration will be replaced: ${current.installedPath} -> ${targetPath}; state: .ai_marketplace/installed.json.${scriptNotice}`, { modal: true }, "Migrate");
  if (confirmation !== "Migrate") return;
  await installer.migrateInstalled(destination, current);
  void vscode.window.showInformationMessage(`Migrated ${current.qualifiedName ?? current.id} to ${destination.manifest.name} for ${current.platform} ${scopeMessage(current.scope)}.`);
}

async function revertPackage(
  installer: PackageInstaller,
  client: RepositoryClient,
  pkg: MarketplacePackage,
  options: PackageActionOptions
): Promise<void> {
  const installed = await pickInstalled(installer, pkg.manifest.id, "Revert which installation?", undefined, options);
  if (!installed) {
    return;
  }
  if (!pkg.manifest.previousVersion) {
    throw new Error(`Package '${pkg.manifest.name}' does not declare a rollback previous_version revision.`);
  }
  if (installed.revertedAt !== undefined || installed.autoUpdate === false) {
    throw new Error(`Package '${pkg.manifest.name}' is already reverted and pinned. Update to the configured branch before reverting again.`);
  }
  if (installed.version !== pkg.manifest.version) {
    throw new Error(`Package '${pkg.manifest.name}' is not at the configured branch version. Update to latest before reverting.`);
  }
  const snapshot = await client.fetchPackageAtRevision(pkg, pkg.manifest.previousVersion);
  if (compareVersions(snapshot.manifest.version, pkg.manifest.version) >= 0) {
    throw new Error(`Rollback revision for '${pkg.manifest.name}' must contain a version older than the configured branch version.`);
  }
  const confirmation = await vscode.window.showWarningMessage(
    `Revert ${pkg.manifest.name} to ${snapshot.manifest.version}? Managed files and host configuration will be replaced, and automatic updates will be pinned off.${pkg.manifest.type === "mcp" ? " This executes the historical install.py with your user privileges." : ""}`,
    { modal: true },
    "Revert"
  );
  if (confirmation !== "Revert") {
    return;
  }
  const reverted = await installer.revertInstalled(snapshot, installed, pkg.manifest.previousVersion);
  void vscode.window.showInformationMessage(`Reverted ${pkg.manifest.name} to ${reverted.version}; automatic updates are pinned off until a manual update.`);
}

async function uninstallPackage(installer: PackageInstaller, packageId: string, options: PackageActionOptions): Promise<void> {
  const installed = await pickUninstallTarget(installer, packageId, options);
  if (!installed) {
    return;
  }
  if (installed.type === "mcp" && installed.managedPayloadPath && !await authorizeMcpScripts([installedScriptLabel(installed)], "uninstall.py")) return;
  await installer.uninstall(installed);
  void vscode.window.showInformationMessage(`Uninstalled ${installed.id} for ${installed.platform}.`);
}

async function pickUninstallTarget(
  installer: PackageInstaller,
  packageId: string,
  options: PackageActionOptions
): Promise<InstalledPackage | undefined> {
  const installed = matchingUninstallTargets(await installer.listInstalled(), {
    packageId,
    sourceId: options.sourceId,
    qualifiedName: options.qualifiedName,
    platform: options.platform
  });
  if (installed.length === 0) {
    void vscode.window.showWarningMessage(`No matching installed package found for ${packageId}.`);
    return undefined;
  }
  const scopes = [...new Set(installed.map((item) => item.scope))];
  if (scopes.length === 1) {
    return installed[0];
  }
  const scope = await pickScope("Uninstall package from", "Choose which installation to remove", scopes);
  return scope === undefined ? undefined : installed.find((item) => item.scope === scope);
}

async function movePackage(
  installer: PackageInstaller,
  packageId: string,
  packageName: string,
  direction: "hotload" | "offload",
  options: PackageActionOptions
): Promise<void> {
  const installed = await pickInstalled(installer, packageId, `${direction === "hotload" ? "Hotload" : "Offload"} which installation?`, direction, options);
  if (!installed) {
    return;
  }
  const result = direction === "hotload" ? await installer.hotload(installed) : await installer.offload(installed);
  void vscode.window.showInformationMessage(`${direction === "hotload" ? "Hotloaded" : "Offloaded"} ${packageName} for ${result.platform}.`);
}

async function pickInstallPlatform(
  pkg: MarketplacePackage,
  allInstalled: readonly InstalledPackage[],
  defaultPlatform: Platform,
  scope: InstallScope,
  action: MarketplaceAction
): Promise<Platform | undefined> {
  const installed = allInstalled.filter((item) =>
    item.id === pkg.manifest.id
    && item.sourceId === pkg.source.id
    && item.qualifiedName === pkg.manifest.qualifiedName
  );
  if (pkg.manifest.type === "mcp") {
    return pickMcpInstallPlatform(pkg, installed, defaultPlatform);
  }
  if (action === "installDifferentPlatform") {
    const items = eligibleInstallPlatforms(pkg, allInstalled, scope)
      .map((platform) => ({
        label: platformLabel(platform),
        description: scope === "global" ? "User directory" : "Workspace",
        platform
      }));
    if (items.length === 0) {
      void vscode.window.showWarningMessage(`No additional platforms are available for ${pkg.manifest.name} ${scopeMessage(scope)}.`);
      return undefined;
    }
    const picked = await vscode.window.showQuickPick(items, {
      title: scope === "global" ? "Install in user directory" : "Install in workspace",
      placeHolder: `Choose a platform for the ${scope === "global" ? "user-directory" : "workspace"} installation`
    });
    return picked?.platform;
  }
  const options = installOptionsForPackage(pkg, installed, defaultPlatform)
    .filter((option) => option.scope === scope);
  const first = options[0];
  if (first) {
    return first.platform;
  }
  const items = platforms
    .filter((platform) => pkg.manifest.platforms.includes(platform))
    .filter((platform) => !installed.some((item) => item.platform === platform && item.scope === scope))
    .map((platform) => ({
      label: platformLabel(platform),
      platform
    }));
  const picked = await vscode.window.showQuickPick(items, { title: "Install target", placeHolder: "Choose where to install this package" });
  return picked?.platform;
}

async function pickMcpInstallPlatform(
  pkg: MarketplacePackage,
  installed: readonly InstalledPackage[],
  defaultPlatform: Platform
): Promise<Platform | undefined> {
  const candidates = mcpInstallPlatformCandidates(pkg, installed, defaultPlatform);
  if (candidates.length === 0) {
    return undefined;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  const picked = await vscode.window.showQuickPick(
    candidates.map((platform) => ({
      label: platformLabel(platform),
      description: path.join(os.homedir(), ...mcpConfigRelativePath(platform).split("/")),
      platform
    })),
    { title: "Configure MCP target", placeHolder: "Choose which user-level MCP config to update" }
  );
  return picked?.platform;
}

async function pickPackage(action: MarketplaceAction): Promise<MarketplacePackage | undefined> {
  const migrationDestinations = action === "migrate" ? new Set(planPackageMigrations(catalogCache, await readAllInstalledPackages()).eligible.map((item) => packageIdentity(item.destination))) : undefined;
  const items = catalogCache.filter((pkg) => !migrationDestinations || migrationDestinations.has(packageIdentity(pkg))).map((pkg) => ({
    label: pkg.manifest.name,
    description: [
      pkg.manifest.type,
      pkg.manifest.version,
      pkg.manifest.group,
      pkg.source.label,
      pkg.manifest.evaluationScore === undefined ? undefined : `evaluation: ${pkg.manifest.evaluationScore}/10`
    ].filter((part): part is string => typeof part === "string").join(" - "),
    detail: pkg.manifest.description,
    pkg
  }));
  const picked = await vscode.window.showQuickPick(items, { title: `AI Marketplace: ${action}`, matchOnDescription: true, matchOnDetail: true });
  return picked?.pkg;
}

async function pickInstalledPackage(direction?: "hotload" | "offload"): Promise<InstalledPackage | undefined> {
  const installed = (await readAllInstalledPackages())
    .filter((item) => direction ? item.scope !== "cloud" : true)
    .filter((item) => direction ? item.type !== "mcp" : true)
    .filter((item) => direction === "hotload" ? item.installedPath.startsWith(".offload/") : true)
    .filter((item) => direction === "offload" ? !item.installedPath.startsWith(".offload/") : true);
  if (installed.length === 0) {
    void vscode.window.showWarningMessage("No AI Marketplace packages are installed.");
    return undefined;
  }
  if (!direction) {
    const groups = new Map<string, InstalledPackage[]>();
    for (const item of installed) {
      const key = `${item.sourceId ?? "legacy"}:${item.qualifiedName ?? item.id}:${item.platform}`;
      const group = groups.get(key);
      if (group) group.push(item);
      else groups.set(key, [item]);
    }
    const picked = await vscode.window.showQuickPick(
      [...groups.values()].map((items) => ({
        label: items[0].id,
        description: `${platformLabel(items[0].platform)} - ${items.map((item) => scopeLabel(item.scope)).join(", ")}`,
        detail: items[0].qualifiedName ?? items[0].sourcePath,
        installed: items[0]
      })),
      { title: "AI Marketplace: uninstall", matchOnDescription: true, matchOnDetail: true }
    );
    return picked?.installed;
  }
  const picked = await vscode.window.showQuickPick(
    installed.map((item) => ({
      label: item.id,
      description: `${item.platform} - ${item.scope} - ${item.version}`,
      detail: item.installedPath,
      installed: item
    })),
    { title: `AI Marketplace: ${direction ?? "uninstall"}`, matchOnDescription: true, matchOnDetail: true }
  );
  return picked?.installed;
}

async function pickInstalled(
  installer: PackageInstaller,
  packageId: string,
  title: string,
  direction?: "hotload" | "offload",
  options: PackageActionOptions = {}
): Promise<InstalledPackage | undefined> {
  const installed = (await installer.listInstalled())
    .filter((item) => item.id === packageId)
    .filter((item) => !options.sourceId || item.sourceId === options.sourceId)
    .filter((item) => !options.qualifiedName || item.qualifiedName === options.qualifiedName)
    .filter((item) => !options.platform || item.platform === options.platform)
    .filter((item) => !options.scope || item.scope === options.scope)
    .filter((item) => direction ? item.scope !== "cloud" : true)
    .filter((item) => direction ? item.type !== "mcp" : true)
    .filter((item) => direction === "hotload" ? item.installedPath.startsWith(".offload/") : true)
    .filter((item) => direction === "offload" ? !item.installedPath.startsWith(".offload/") : true);
  if (installed.length === 0) {
    void vscode.window.showWarningMessage(`No matching installed package found for ${packageId}.`);
    return undefined;
  }
  if (installed.length === 1) {
    return installed[0];
  }
  const picked = await vscode.window.showQuickPick(
    installed.map((item) => ({
      label: item.platform,
      description: `${item.scope} - ${item.version}`,
      detail: item.installedPath,
      installed: item
    })),
    { title }
  );
  return picked?.installed;
}

async function updateWebview(): Promise<void> {
  if (!webview) {
    return;
  }
  webview.update(await buildMarketplaceModel());
}

async function buildMarketplaceModel(): Promise<{
  readonly packages: readonly MarketplacePackage[];
  readonly installed: readonly InstalledPackage[];
  readonly configured: boolean;
  readonly autoUpdateEnabled: boolean;
  readonly autoInstallGroups: readonly string[];
  readonly knownGroups: readonly string[];
  readonly defaultPlatform: Platform;
  readonly extensionVersion: string;
  readonly repositories: readonly EditableRepositorySetting[];
}> {
  const config = tryReadMarketplaceConfig();
  const automation = readUserAutomationPreferences();
  const installed: readonly InstalledPackage[] = await readAllInstalledPackages();
  return {
    packages: catalogCache,
    installed,
    configured: Boolean(config?.repositories?.length),
    autoUpdateEnabled: automation.autoUpdateEnabled,
    autoInstallGroups: automation.autoInstallGroups,
    knownGroups: collectPackageGroups(catalogCache, installed),
    defaultPlatform: config?.defaultPlatform ?? "codex",
    extensionVersion,
    repositories: config ? readEditableRepositorySettings() : []
  };
}

function scopeMessage(scope: InstallScope): string {
  switch (scope) {
    case "workspace":
      return "in the workspace";
    case "global":
      return "in the user directory";
    case "cloud":
      return "in the cloud";
  }
}

function scopeLabel(scope: InstallScope): string {
  switch (scope) {
    case "workspace":
      return "Workspace";
    case "global":
      return "User directory";
    case "cloud":
      return "Cloud";
  }
}

function platformLabel(platform: Platform): string {
  switch (platform) {
    case "codex":
      return "Codex";
    case "cursor":
      return "Cursor";
    case "github-copilot":
      return "GitHub Copilot";
    case "claude":
      return "Claude";
  }
}

function repositoryProviderLabel(provider: RepositoryProvider): string {
  return provider === "github" ? "GitHub" : provider === "azure-devops" ? "Azure DevOps" : "GitLab";
}

function createRepositoryClient(
  context: vscode.ExtensionContext,
  config: ReturnType<typeof readMarketplaceConfig>
): RepositoryClient {
  return new RepositoryClient(config, createVscodeCredentialProvider(context.secrets), log);
}

function findCatalogPackage(packageId: string, options: PackageActionOptions): MarketplacePackage | undefined {
  return catalogCache.find((item) =>
    item.manifest.id === packageId
    && (!options.sourceId || item.source.id === options.sourceId)
    && (!options.qualifiedName || item.manifest.qualifiedName === options.qualifiedName)
  );
}

function requirePackage(pkg: MarketplacePackage | undefined): MarketplacePackage {
  if (!pkg) {
    throw new Error("Package is not loaded in the catalog.");
  }
  return pkg;
}

function log(message: string): void {
  output.appendLine(redactSecrets(message));
}

async function authorizeMcpScripts(packages: readonly string[], script: "install.py" | "uninstall.py"): Promise<boolean> {
  const listed = packages.slice(0, 5).join(", ");
  const remainder = packages.length > 5 ? ` and ${packages.length - 5} more` : "";
  const confirmation = await vscode.window.showWarningMessage(
    `Run ${script} from ${packages.length} MCP package(s) with your user privileges? Source packages can install or remove software and are not sandboxed: ${listed}${remainder}.`,
    { modal: true },
    "Run script"
  );
  return confirmation === "Run script";
}

function packageScriptLabel(pkg: MarketplacePackage): string {
  return `${pkg.manifest.qualifiedName} (${repositoryIdentity(pkg.source)})`;
}

function installedScriptLabel(installed: InstalledPackage): string {
  return `${installed.qualifiedName ?? installed.id} (${installed.sourceRepo})`;
}

function redactSecrets(message: string): string {
  return message
    .replace(/(?:ghp|github_pat|glpat|azdopat)_[A-Za-z0-9_-]+/gi, "<redacted>")
    .replace(/(authorization:\s*(?:basic|bearer)\s+)[a-z0-9._~+/=-]+/ig, "$1<redacted>")
    .replace(/(private-token:\s*)\S+/ig, "$1<redacted>");
}

async function applyAutoUpdates(config: ReturnType<typeof readMarketplaceConfig>, client: RepositoryClient): Promise<number> {
  let workspaceRoot: vscode.Uri;
  try {
    workspaceRoot = getWorkspaceRoot();
  } catch {
    return 0;
  }
  const installer = new PackageInstaller(
    workspaceRoot,
    config,
    (selectedPackage) => client.fetchPackageFiles(selectedPackage)
  );
  if (!config.autoUpdateEnabled) {
    return 0;
  }
  let updatedCount = 0;
  for (const installed of await installer.listInstalled()) {
    if (installed.autoUpdate === false) {
      continue;
    }
    const pkg = catalogCache.find((item) => item.manifest.id === installed.id
      && (!installed.sourceId || item.source.id === installed.sourceId)
      && (!installed.qualifiedName || item.manifest.qualifiedName === installed.qualifiedName));
    if (!pkg || !isUpdateAvailable(installed.version, pkg.manifest.version)) {
      continue;
    }
    if (pkg.manifest.type === "mcp") {
      log(`Skipped automatic MCP update for ${installed.id}: executable package scripts require an explicit reviewed action.`);
      continue;
    }
    await installer.updateInstalled(pkg, installed);
    updatedCount += 1;
    log(`Auto-updated ${installed.id} (${installed.platform}) from ${installed.version} to ${pkg.manifest.version}.`);
  }
  return updatedCount;
}

async function toggleGlobalAutoUpdate(context: vscode.ExtensionContext): Promise<void> {
  try {
    const enabled = !readUserAutomationPreferences().autoUpdateEnabled;
    await writeUserAutoUpdate(enabled);
    let updatedCount = 0;

    if (enabled) {
      updatedCount = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Applying AI Marketplace auto updates", cancellable: false },
        async () => {
          const config = readMarketplaceConfig();
          const client = createRepositoryClient(context, config);
          catalogCache = await client.listMarketplacePackages();
          return applyAutoUpdates(config, client);
        }
      );
    }

    await updateWebview();
    const suffix = enabled && updatedCount > 0 ? ` Applied ${updatedCount} update(s).` : "";
    void vscode.window.showInformationMessage(`Auto update ${enabled ? "enabled" : "disabled"}.${suffix}`);
  } catch (error) {
    await reportError("AI Marketplace auto update toggle failed", error);
  }
}

async function applyDefaultPackageInstalls(config: ReturnType<typeof readMarketplaceConfig>, client: RepositoryClient): Promise<number> {
  let workspaceRoot: vscode.Uri;
  try {
    workspaceRoot = getWorkspaceRoot();
  } catch {
    return 0;
  }
  const installer = new PackageInstaller(
    workspaceRoot,
    config,
    (selectedPackage) => client.fetchPackageFiles(selectedPackage)
  );
  const planned = defaultPackageInstallPlans(catalogCache, await installer.listInstalled(), config.defaultPlatform, config);
  const plans = planned.filter((plan) => plan.pkg.manifest.type !== "mcp");
  for (const plan of planned.filter((item) => item.pkg.manifest.type === "mcp")) {
    log(`Skipped automatic default MCP install for ${plan.pkg.manifest.id}: executable package scripts require an explicit reviewed action.`);
  }
  let installedCount = 0;
  for (const plan of plans) {
    await installer.install(plan.pkg, plan.platform, "global");
    installedCount += 1;
    log(`Installed default package ${plan.pkg.manifest.id} (${plan.platform}) in the user directory.`);
  }
  return installedCount;
}

async function installPackageByGroup(context: vscode.ExtensionContext): Promise<void> {
  try {
    if (catalogCache.length === 0) await refresh(context, false);
    const groups = collectPackageGroups(catalogCache);
    const pickedGroup = await vscode.window.showQuickPick(groups, { title: "Install package group", placeHolder: "Choose a group" });
    if (!pickedGroup) return;
    const pickedScope = await vscode.window.showQuickPick([
      { label: "Workspace", scope: "workspace" as const },
      { label: "User directory", scope: "global" as const }
    ], { title: `Install ${pickedGroup}`, placeHolder: "Choose the installation scope" });
    if (!pickedScope) return;
    await runGroupInstall(context, pickedGroup, pickedScope.scope);
  } catch (error) {
    await reportError("AI Marketplace group install failed", error);
  }
}

async function runGroupInstall(context: vscode.ExtensionContext, group: string, scope: GroupInstallScope): Promise<void> {
  const config = readMarketplaceConfig();
  const workspaceRoot = getWorkspaceRoot();
  let client: RepositoryClient | undefined;
  const installer = new PackageInstaller(workspaceRoot, config, async (pkg) => {
    client ??= createRepositoryClient(context, config);
    return client.fetchPackageFiles(pkg);
  });
  const plans = planGroupInstall(group, scope, catalogCache, await installer.listInstalled(), config.defaultPlatform);
  const scripted = plans.filter((plan) => plan.pkg.manifest.type === "mcp").map((plan) => packageScriptLabel(plan.pkg));
  if (scripted.length > 0 && !await authorizeMcpScripts(scripted, "install.py")) return;
  let installedCount = 0;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Installing ${group} packages ${scopeMessage(scope)}`, cancellable: false },
    async () => {
      for (const plan of plans) {
        await installer.install(plan.pkg, plan.platform, plan.scope);
        installedCount += 1;
      }
    }
  );
  await updateWebview();
  void vscode.window.showInformationMessage(`Installed ${installedCount} package(s) from ${group} ${scopeMessage(scope)}.`);
}

async function configureAutoInstallGroups(): Promise<void> {
  try {
    const enabled = new Set(readUserAutomationPreferences().autoInstallGroups);
    const groups = [...new Set([...collectPackageGroups(catalogCache, await readAllInstalledPackages()), ...enabled])].sort();
    const picked = await vscode.window.showQuickPick(
      groups.map((group) => ({ label: group, picked: enabled.has(group) })),
      { title: "Automatic package groups", placeHolder: "Selected groups install missing packages in the user directory after refresh", canPickMany: true }
    );
    if (!picked) return;
    await writeUserAutoInstallGroups(picked.map((item) => item.label));
    await updateWebview();
    void vscode.window.showInformationMessage(`Automatic package groups updated (${picked.length} enabled).`);
  } catch (error) {
    await reportError("AI Marketplace automatic group configuration failed", error);
  }
}

async function setAutoInstallGroups(groups: readonly string[]): Promise<void> {
  try {
    await writeUserAutoInstallGroups(groups);
    await updateWebview();
  } catch (error) {
    await reportError("AI Marketplace failed to save auto-install groups", error);
  }
}

async function saveRepository(
  context: vscode.ExtensionContext,
  originalId: string | undefined,
  repository: EditableRepositorySetting
): Promise<void> {
  try {
    let current: EditableRepositorySetting[];
    try {
      current = [...readEditableRepositorySettings()];
    } catch (error) {
      if (originalId !== undefined) throw error;
      current = [];
    }
    if (originalId === undefined) {
      current.push(repository);
    } else {
      if (repository.id !== originalId) throw new Error("Repository IDs cannot be changed after creation.");
      const index = current.findIndex((item) => item.id === originalId);
      if (index < 0) throw new Error(`Repository '${originalId}' is no longer configured.`);
      current[index] = repository;
    }
    const saved = await writeUserRepositorySettings(current);
    await refreshAfterRepositoryChange(context, saved.length);
  } catch (error) {
    await reportError("AI Marketplace failed to save repository", error);
  }
}

async function removeRepository(context: vscode.ExtensionContext, repositoryId: string): Promise<void> {
  try {
    const current = [...readEditableRepositorySettings()];
    const repository = current.find((item) => item.id === repositoryId);
    if (!repository) throw new Error(`Repository '${repositoryId}' is no longer configured.`);
    const confirmed = await vscode.window.showWarningMessage(
      `Remove repository '${repository.label}' from AI Marketplace configuration? Installed packages and saved credentials will be preserved.`,
      { modal: true },
      "Remove"
    );
    if (confirmed !== "Remove") return;
    const saved = await writeUserRepositorySettings(current.filter((item) => item.id !== repositoryId));
    await refreshAfterRepositoryChange(context, saved.length);
  } catch (error) {
    await reportError("AI Marketplace failed to remove repository", error);
  }
}

async function refreshAfterRepositoryChange(context: vscode.ExtensionContext, repositoryCount: number): Promise<void> {
  if (repositoryCount === 0) {
    catalogCache = [];
    await updateWebview();
    void vscode.window.showInformationMessage("AI Marketplace repository configuration is empty. Installed packages remain available offline.");
    return;
  }
  await refresh(context, true);
}

async function applyAutoInstallGroups(config: ReturnType<typeof readMarketplaceConfig>, client: RepositoryClient): Promise<number> {
  let workspaceRoot: vscode.Uri;
  try { workspaceRoot = getWorkspaceRoot(); } catch { return 0; }
  if ((config.autoInstallGroups ?? []).length === 0) return 0;
  const installer = new PackageInstaller(workspaceRoot, config, (pkg) => client.fetchPackageFiles(pkg));
  const planned = autoInstallGroupPlans(catalogCache, await installer.listInstalled(), config.autoInstallGroups ?? [], config.defaultPlatform);
  const plans = planned.filter((plan) => plan.pkg.manifest.type !== "mcp");
  for (const plan of planned.filter((item) => item.pkg.manifest.type === "mcp")) {
    log(`Skipped automatic group MCP install for ${plan.pkg.manifest.id}: executable package scripts require an explicit reviewed action.`);
  }
  let installedCount = 0;
  for (const plan of plans) {
    await installer.install(plan.pkg, plan.platform, "global");
    installedCount += 1;
    log(`Installed automatic group package ${plan.pkg.manifest.id} (${plan.platform}) in the user directory.`);
  }
  return installedCount;
}

async function applyAutoDiscovery(config: ReturnType<typeof readMarketplaceConfig>): Promise<number> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const roots: { readonly scope: Exclude<InstallScope, "cloud">; readonly root: vscode.Uri }[] = [
    ...(workspaceFolder ? [{ scope: "workspace" as const, root: workspaceFolder.uri }] : []),
    { scope: "global", root: vscode.Uri.file(os.homedir()) }
  ];
  const existing = [...await readAllInstalledPackages()];
  let discoveredCount = 0;

  for (const { scope, root } of roots) {
    const stateStore = new InstalledStateStore(root);
    const discovered = await discoverInstalledPackages({
      config,
      catalog: catalogCache,
      existing: [...existing],
      scope,
      fileSystem: vscodeAutoDiscoveryFileSystem(root),
      now: () => new Date().toISOString(),
      log
    });

    for (const pkg of discovered) {
      await stateStore.upsert(pkg);
      existing.push(pkg);
      discoveredCount += 1;
      log(`Auto-discovered ${pkg.id} (${pkg.platform}, ${pkg.scope}) at ${pkg.installedPath}.`);
    }
  }

  return discoveredCount;
}

function vscodeAutoDiscoveryFileSystem(root: vscode.Uri): AutoDiscoveryFileSystem {
  return {
    async readDirectory(relativePath: string): Promise<readonly AutoDiscoveryDirectoryEntry[] | undefined> {
      const uri = vscode.Uri.joinPath(root, ...relativePath.split("/"));
      try {
        const entries = await vscode.workspace.fs.readDirectory(uri);
        return entries.map(([name, type]) => ({
          name,
          isDirectory: Boolean(type & vscode.FileType.Directory),
          isSymbolicLink: Boolean(type & vscode.FileType.SymbolicLink)
        }));
      } catch (error) {
        if (isFileNotFound(error)) {
          return undefined;
        }
        throw error;
      }
    },
    async readText(relativePath: string): Promise<string> {
      const uri = vscode.Uri.joinPath(root, ...relativePath.split("/"));
      const bytes = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString("utf8");
    }
  };
}

async function readAllInstalledPackages(): Promise<readonly InstalledPackage[]> {
  const packages: InstalledPackage[] = [];
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    try {
      packages.push(...(await new InstalledStateStore(workspaceFolder.uri).read()).packages);
    } catch (error) {
      log(`Failed to read workspace AI Marketplace installed state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  try {
    packages.push(...(await new InstalledStateStore(vscode.Uri.file(os.homedir())).read()).packages);
  } catch (error) {
    log(`Failed to read user AI Marketplace installed state: ${error instanceof Error ? error.message : String(error)}`);
  }
  return packages;
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof vscode.FileSystemError && error.code === "FileNotFound";
}

function currentExtensionVersion(context: vscode.ExtensionContext): string {
  const packageJson = context.extension.packageJSON as { readonly version?: unknown };
  return typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
}

async function showChangelogAfterUpdate(context: vscode.ExtensionContext): Promise<void> {
  try {
    const packageJson = context.extension.packageJSON as { readonly version?: unknown };
    const currentVersion = typeof packageJson.version === "string" ? packageJson.version : "0.0.0";
    const previousVersion = context.globalState.get<string>(lastSeenVersionKey);
    const changelogSeenVersionKey = `${changelogSeenVersionKeyPrefix}${currentVersion}`;
    const changelogSeenForCurrentVersion = context.globalState.get<boolean>(changelogSeenVersionKey);
    await context.globalState.update(lastSeenVersionKey, currentVersion);
    if (!previousVersion || previousVersion === currentVersion || changelogSeenForCurrentVersion) {
      return;
    }
    const changelogUri = vscode.Uri.joinPath(context.extensionUri, "CHANGELOG.md");
    await vscode.commands.executeCommand("markdown.showPreview", changelogUri);
    await context.globalState.update(changelogSeenVersionKey, true);
    log(`Opened changelog after update from ${previousVersion} to ${currentVersion}.`);
  } catch (error) {
    log(`Failed to show AI Marketplace changelog: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function reportError(prefix: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  log(`${prefix}: ${message}`);
  const choice = await vscode.window.showErrorMessage(`${prefix}: ${message}`, "Show Output");
  if (choice === "Show Output") {
    output.show();
  }
}
