import * as vscode from "vscode";
import { toSerializableMarketplaceModel } from "../services/marketplaceModel";
import { type InstallScope, type InstalledPackage, type MarketplaceAction, type MarketplacePackage, type Platform } from "../types/packages";
import type { EditableRepositorySetting } from "../services/configuration";
import { parseEditableRepository } from "./marketplaceMessages";

export interface MarketplaceViewModel {
  readonly packages: readonly MarketplacePackage[];
  readonly installed: readonly InstalledPackage[];
  readonly configured: boolean;
  readonly autoUpdateEnabled: boolean;
  readonly autoInstallGroups: readonly string[];
  readonly knownGroups: readonly string[];
  readonly defaultPlatform: Platform;
  readonly extensionVersion: string;
  readonly repositories: readonly EditableRepositorySetting[];
}

interface WebviewMessage {
  readonly command?: unknown;
  readonly packageId?: unknown;
  readonly action?: unknown;
  readonly platform?: unknown;
  readonly scope?: unknown;
  readonly sourceId?: unknown;
  readonly qualifiedName?: unknown;
  readonly destinationSourceId?: unknown;
  readonly destinationQualifiedName?: unknown;
  readonly predecessorId?: unknown;
  readonly predecessorSourceId?: unknown;
  readonly predecessorQualifiedName?: unknown;
  readonly selections?: unknown;
  readonly groups?: unknown;
  readonly repository?: unknown;
  readonly originalId?: unknown;
  readonly repositoryId?: unknown;
}

export interface PackageActionOptions {
  readonly platform?: Platform;
  readonly scope?: InstallScope;
  readonly sourceId?: string;
  readonly qualifiedName?: string;
  readonly destinationSourceId?: string;
  readonly destinationQualifiedName?: string;
  readonly predecessorId?: string;
  readonly predecessorSourceId?: string;
  readonly predecessorQualifiedName?: string;
}

export interface BulkPackageAction extends PackageActionOptions {
  readonly action: MarketplaceAction;
  readonly packageId: string;
}

export class MarketplaceWebview implements vscode.WebviewViewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private view: vscode.WebviewView | undefined;
  private latestModel: MarketplaceViewModel = {
    packages: [],
    installed: [],
    configured: false,
    autoUpdateEnabled: false,
    autoInstallGroups: [],
    knownGroups: [],
    defaultPlatform: "codex",
    extensionVersion: "0.0.0",
    repositories: []
  };

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onAction: (action: MarketplaceAction, packageId: string, options: PackageActionOptions) => Promise<void>,
    private readonly onBulkActions: (actions: readonly BulkPackageAction[]) => Promise<void>,
    private readonly onRefresh: () => Promise<void>,
    private readonly onSetRepositoryCredential: () => Promise<void>,
    private readonly onToggleAutoUpdate: () => Promise<void>,
    private readonly onInstallByGroup: () => Promise<void>,
    private readonly onSetAutoInstallGroups: (groups: readonly string[]) => Promise<void>,
    private readonly onSaveRepository: (originalId: string | undefined, repository: EditableRepositorySetting) => Promise<void>,
    private readonly onRemoveRepository: (repositoryId: string) => Promise<void>
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    this.view.onDidDispose(() => {
      this.view = undefined;
    });
    this.view.webview.onDidReceiveMessage((message: WebviewMessage) => this.handleMessage(message));
    this.renderInto(this.view.webview, this.latestModel);
  }

  public revealPanel(model: MarketplaceViewModel): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "aiMarketplace",
        "AI Marketplace",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.extensionUri]
        }
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
      this.panel.webview.onDidReceiveMessage((message: WebviewMessage) => this.handleMessage(message));
    }
    this.update(model);
    this.panel.reveal(vscode.ViewColumn.One);
  }

  public update(model: MarketplaceViewModel): void {
    this.latestModel = model;
    if (this.panel) {
      this.renderInto(this.panel.webview, model);
    }
    if (this.view) {
      this.renderInto(this.view.webview, model);
    }
  }

  private renderInto(webview: vscode.Webview, model: MarketplaceViewModel): void {
    const nonce = createNonce();
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "ai-marketplace-transparent.png"));
    webview.html = renderHtml(webview, nonce, model, iconUri);
  }

  private async handleMessage(message: WebviewMessage | unknown): Promise<void> {
    if (!isMessageRecord(message)) return;
    if (message.command === "refresh") {
      await this.onRefresh();
      return;
    }
    if (message.command === "setRepositoryCredential") {
      await this.onSetRepositoryCredential();
      return;
    }
    if (message.command === "toggleAutoUpdate") {
      await this.onToggleAutoUpdate();
      return;
    }
    if (message.command === "installByGroup") {
      await this.onInstallByGroup();
      return;
    }
    if (message.command === "setAutoInstallGroups" && Array.isArray(message.groups)) {
      const groups = message.groups.filter((group): group is string => typeof group === "string");
      if (groups.length === message.groups.length) await this.onSetAutoInstallGroups(groups);
      return;
    }
    if (message.command === "saveRepository") {
      const repository = parseEditableRepository(message.repository);
      if (repository && (message.originalId === undefined || typeof message.originalId === "string")) {
        await this.onSaveRepository(message.originalId, repository);
      }
      return;
    }
    if (message.command === "removeRepository" && typeof message.repositoryId === "string") {
      await this.onRemoveRepository(message.repositoryId);
      return;
    }
    if (message.command === "bulkPackageAction" && Array.isArray(message.selections)) {
      const actions = message.selections.map(parseBulkAction).filter((item): item is BulkPackageAction => item !== undefined);
      if (actions.length === message.selections.length && actions.length > 0) {
        await this.onBulkActions(actions);
      }
      return;
    }
    if (message.command !== "packageAction" || typeof message.packageId !== "string" || !isAction(message.action) || !hasValidOptionalActionFields(message)) {
      return;
    }
    await this.onAction(message.action, message.packageId, {
      platform: isPlatform(message.platform) ? message.platform : undefined,
      scope: isInstallScope(message.scope) ? message.scope : undefined,
      sourceId: typeof message.sourceId === "string" ? message.sourceId : undefined,
      qualifiedName: typeof message.qualifiedName === "string" ? message.qualifiedName : undefined,
      destinationSourceId: typeof message.destinationSourceId === "string" ? message.destinationSourceId : undefined,
      destinationQualifiedName: typeof message.destinationQualifiedName === "string" ? message.destinationQualifiedName : undefined,
      predecessorId: typeof message.predecessorId === "string" ? message.predecessorId : undefined,
      predecessorSourceId: typeof message.predecessorSourceId === "string" ? message.predecessorSourceId : undefined,
      predecessorQualifiedName: typeof message.predecessorQualifiedName === "string" ? message.predecessorQualifiedName : undefined
    });
  }
}

export function parseBulkAction(value: unknown): BulkPackageAction | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (!isBulkAction(record.action) || typeof record.packageId !== "string" || !hasValidOptionalActionFields(record)) {
    return undefined;
  }
  return {
    action: record.action,
    packageId: record.packageId,
    platform: isPlatform(record.platform) ? record.platform : undefined,
    scope: isInstallScope(record.scope) ? record.scope : undefined,
    sourceId: typeof record.sourceId === "string" ? record.sourceId : undefined,
    qualifiedName: typeof record.qualifiedName === "string" ? record.qualifiedName : undefined,
    destinationSourceId: typeof record.destinationSourceId === "string" ? record.destinationSourceId : undefined,
    destinationQualifiedName: typeof record.destinationQualifiedName === "string" ? record.destinationQualifiedName : undefined,
    predecessorId: typeof record.predecessorId === "string" ? record.predecessorId : undefined,
    predecessorSourceId: typeof record.predecessorSourceId === "string" ? record.predecessorSourceId : undefined,
    predecessorQualifiedName: typeof record.predecessorQualifiedName === "string" ? record.predecessorQualifiedName : undefined
  };
}

function isMessageRecord(value: unknown): value is WebviewMessage { return typeof value === "object" && value !== null && !Array.isArray(value); }
function hasValidOptionalActionFields(value: WebviewMessage | Record<string, unknown>): boolean { return (value.platform === undefined || isPlatform(value.platform)) && (value.scope === undefined || isInstallScope(value.scope)) && (value.sourceId === undefined || typeof value.sourceId === "string") && (value.qualifiedName === undefined || typeof value.qualifiedName === "string") && (value.destinationSourceId === undefined || typeof value.destinationSourceId === "string") && (value.destinationQualifiedName === undefined || typeof value.destinationQualifiedName === "string") && (value.predecessorId === undefined || typeof value.predecessorId === "string") && (value.predecessorSourceId === undefined || typeof value.predecessorSourceId === "string") && (value.predecessorQualifiedName === undefined || typeof value.predecessorQualifiedName === "string"); }
function isBulkAction(value: unknown): value is "install" | "update" | "migrate" | "uninstall" | "hotload" | "offload" { return value === "install" || value === "update" || value === "migrate" || value === "uninstall" || value === "hotload" || value === "offload"; }

function renderHtml(webview: vscode.Webview, nonce: string, model: MarketplaceViewModel, iconUri: vscode.Uri): string {
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${webview.cspSource} https: data:`
  ].join("; ");
  const data = JSON.stringify(toSerializableModel(model)).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Marketplace</title>
  <style>
    :root {
      color-scheme: light dark;
      --border: var(--vscode-panel-border);
      --muted: var(--vscode-descriptionForeground);
      --button: var(--vscode-button-background);
      --button-text: var(--vscode-button-foreground);
      --button-secondary: var(--vscode-button-secondaryBackground);
      --button-secondary-text: var(--vscode-button-secondaryForeground);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    header {
      display: grid;
      grid-template-columns: auto auto 1fr auto auto;
      gap: 8px;
      align-items: center;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--vscode-editor-background);
      z-index: 1;
    }
    h1 { font-size: 18px; margin: 0; font-weight: 600; }
    .brand-icon {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: block;
    }
    .brand-version {
      color: var(--muted);
      white-space: nowrap;
    }
    main { padding: 16px 18px 28px; }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) auto;
      gap: 10px;
      margin-bottom: 10px;
    }
    .filter-panel {
      display: grid;
      grid-template-columns: repeat(3, minmax(140px, 1fr));
      gap: 10px;
      padding: 12px;
      margin-bottom: 16px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--vscode-sideBar-background);
    }
    .filter-panel[hidden] { display: none; }
    .filter-toggle { display: inline-flex; align-items: center; gap: 5px; }
    .filter-icon { width: 15px; height: 15px; fill: currentColor; }
    .filter-count { min-width: 16px; padding: 1px 4px; border-radius: 999px; color: var(--vscode-badge-foreground); background: var(--vscode-badge-background); font-size: 11px; line-height: 1.2; }
    .filter-field { display: grid; gap: 5px; color: var(--muted); }
    .repository-filter { grid-column: 1 / -1; padding: 0; border: 0; margin: 0; }
    .repository-filter legend { margin-bottom: 6px; color: var(--muted); }
    .repository-options { display: flex; flex-wrap: wrap; gap: 7px 14px; }
    .repository-option { display: inline-flex; gap: 6px; align-items: center; }
    .repository-option input { width: auto; margin: 0; }
    .filter-footer { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
    .tabs {
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 14px;
    }
    .tab {
      color: var(--vscode-tab-inactiveForeground);
      background: transparent;
      border-radius: 0;
      border-bottom: 2px solid transparent;
      padding: 7px 10px;
    }
    .tab.active {
      color: var(--vscode-tab-activeForeground);
      border-bottom-color: var(--vscode-focusBorder);
    }
    input, select {
      width: 100%;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      padding: 7px 9px;
      border-radius: 3px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    article {
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 13px;
      background: var(--vscode-sideBar-background);
      min-width: 0;
    }
    .title-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 8px;
      align-items: center;
      margin-bottom: 4px;
    }
    h2 {
      font-size: 14px;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .version, .meta, .description, .empty {
      color: var(--muted);
    }
    .description {
      margin: 8px 0 12px;
      min-height: 34px;
      line-height: 1.35;
    }
    .chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .chip {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 2px 7px;
      color: var(--muted);
      font-size: 11px;
    }
    .chip.update {
      color: var(--vscode-editorWarning-foreground);
      border-color: var(--vscode-editorWarning-foreground);
    }
    .scope-badge { color: var(--vscode-badge-foreground); background: var(--vscode-badge-background); border-color: transparent; }
    .install-locations { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
    .installation-location { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; }
    .actions {
      display: flex;
      gap: 7px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .action-menu { display: grid; gap: 4px; min-width: 0; max-width: 100%; }
    .action-menu [role="menu"] { display: none; min-width: 0; max-width: 100%; box-sizing: border-box; padding: 4px; border: 1px solid var(--border); background: var(--vscode-menu-background, var(--vscode-editor-background)); }
    .action-menu.open [role="menu"] { display: grid; gap: 3px; }
    .action-menu [role="menuitem"] { width: 100%; min-width: 0; overflow-wrap: anywhere; text-align: left; }
    .bulk-actions {
      display: flex;
      gap: 7px;
      flex-wrap: wrap;
      align-items: center;
      padding: 10px;
      margin-bottom: 14px;
      border: 1px solid var(--border);
      border-radius: 4px;
    }
    .bulk-actions span { margin-right: auto; color: var(--muted); }
    button.select-package {
      width: 20px;
      min-width: 20px;
      height: 20px;
      padding: 0;
      font-size: 0;
      color: var(--vscode-foreground);
      background: transparent;
      border: 1px solid var(--border);
      font-weight: 600;
    }
    button.select-package:hover { background: var(--vscode-list-hoverBackground); }
    button.select-package.selected {
      color: var(--button-text);
      background: var(--vscode-testing-iconPassed);
      border-color: var(--vscode-testing-iconPassed);
    }
    button.select-package::after { content: ""; font-size: 12px; }
    button.select-package.selected::after { content: "✓"; }
    button {
      border: 0;
      border-radius: 3px;
      padding: 6px 10px;
      color: var(--button-text);
      background: var(--button);
      cursor: pointer;
      min-height: 28px;
    }
    button.secondary {
      color: var(--button-secondary-text);
      background: var(--button-secondary);
    }
    button.warning {
      color: var(--vscode-editor-background);
      background: var(--vscode-editorWarning-foreground);
    }
    button.danger {
      color: var(--vscode-button-foreground);
      background: var(--vscode-errorForeground);
    }
    button.toggle {
      color: var(--vscode-foreground);
      background: transparent;
      border: 1px solid var(--border);
    }
    button.toggle.active {
      color: var(--button-text);
      background: var(--button);
      border-color: var(--button);
    }
    button.load-switch {
      color: var(--vscode-button-foreground);
      min-width: 78px;
    }
    button.load-switch.onload {
      background: var(--vscode-testing-iconPassed);
    }
    button.load-switch.offload {
      background: var(--vscode-testing-iconFailed);
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .empty {
      border: 1px dashed var(--border);
      padding: 20px;
      border-radius: 4px;
    }
    .extension-update {
      display: none;
      border: 1px solid var(--vscode-editorWarning-foreground);
      background: var(--vscode-inputValidation-warningBackground);
      color: var(--vscode-foreground);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .extension-update.visible {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
    }
    .extension-update strong {
      display: block;
      margin-bottom: 3px;
    }
    .configuration-settings { display: grid; gap: 16px; max-width: 760px; }
    .configuration-section { border: 1px solid var(--border); border-radius: 4px; padding: 14px; background: var(--vscode-sideBar-background); display: grid; gap: 10px; }
    .configuration-section h2 { font-size: 14px; margin: 0; }
    .configuration-section p { margin: 0; color: var(--muted); line-height: 1.35; }
    .configuration-section .actions { margin-top: 2px; }
    .configuration-heading { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
    .configured-repositories { display: grid; gap: 8px; }
    .configured-repository { border: 1px solid var(--border); border-radius: 4px; padding: 10px; display: grid; gap: 6px; }
    .repository-title { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
    .repository-form { border-top: 1px solid var(--border); padding-top: 12px; display: grid; gap: 12px; }
    .repository-form[hidden] { display: none; }
    .repository-form-grid { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 10px; }
    .repository-form label { display: grid; gap: 5px; color: var(--muted); }
    .repository-form .checkbox-field { display: flex; gap: 8px; align-items: center; color: var(--vscode-foreground); }
    .repository-form .checkbox-field input { width: auto; margin: 0; }
    .package-folder-fields { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 10px; padding: 0; border: 0; margin: 0; }
    .package-folder-fields legend { margin-bottom: 8px; color: var(--vscode-foreground); }
    .group-checklist { display: grid; gap: 8px; max-height: 240px; overflow: auto; padding: 4px 0; }
    .group-option { display: inline-flex; gap: 8px; align-items: center; }
    .group-option input { width: auto; margin: 0; }
    .package-list-ui[hidden], .configuration-settings[hidden] { display: none; }
    @media (max-width: 520px) {
      header, .toolbar, .filter-panel { grid-template-columns: 1fr; }
      .repository-filter, .filter-footer { grid-column: 1; }
      .actions, .bulk-actions { display: grid; grid-template-columns: 1fr; width: 100%; }
      .actions > button, .action-menu, .action-menu > button { width: 100%; }
      .action-menu [role="menu"] { width: 100%; }
      .repository-form-grid, .package-folder-fields { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <img class="brand-icon" src="${iconUri.toString()}" alt="" aria-hidden="true">
    <span class="brand-version" aria-label="AI Marketplace version ${escapeHtmlText(model.extensionVersion)}">v${escapeHtmlText(model.extensionVersion)}</span>
    <h1>AI Marketplace</h1>
    <button id="installGroup" class="secondary" type="button">Install by group</button>
    <button id="refresh" class="secondary" type="button">Refresh</button>
  </header>
  <main>
    <nav class="tabs" aria-label="Marketplace views">
      <button id="availableTab" class="tab active" type="button" role="tab" aria-selected="true">Available</button>
      <button id="installedTab" class="tab" type="button" role="tab" aria-selected="false">Installed</button>
      <button id="configurationTab" class="tab" type="button" role="tab" aria-selected="false">Configuration</button>
    </nav>
    <div id="packageListUi" class="package-list-ui">
    <section class="toolbar" aria-label="Marketplace filters">
      <input id="search" type="search" placeholder="Search packages" aria-label="Search packages">
      <button id="filterToggle" class="secondary filter-toggle" type="button" aria-label="Filters" title="Filters" aria-expanded="false" aria-controls="filterPanel"><svg class="filter-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M1 2h14l-5.25 6.1V13l-3.5 1V8.1L1 2z"></path></svg><span id="filterCount" class="filter-count" aria-hidden="true"></span></button>
    </section>
    <section id="filterPanel" class="filter-panel" aria-label="Additional marketplace filters" hidden>
      <label class="filter-field">Package type<select id="type" aria-label="Filter by type"><option value="">All package types</option><option value="skill">Skills</option><option value="command">Commands</option><option value="mcp">MCPs</option><option value="agent">Agents</option><option value="hook">Hooks</option><option value="rule">Rules</option></select></label>
      <label class="filter-field">Platform<select id="platform" aria-label="Filter by platform"><option value="">All platforms</option><option value="codex">Codex</option><option value="cursor">Cursor</option><option value="github-copilot">GitHub Copilot</option><option value="claude">Claude</option></select></label>
      <label class="filter-field">Group<select id="group" aria-label="Filter by group"><option value="">All groups</option></select></label>
      <fieldset class="repository-filter"><legend>Repositories</legend><div id="repositoryOptions" class="repository-options"></div></fieldset>
      <div class="filter-footer"><button id="clearFilters" class="secondary" type="button">Clear filters</button></div>
    </section>
    <section class="bulk-actions" aria-label="Selected package actions">
      <span id="selectionCount" aria-live="polite">No packages selected</span>
      <button id="selectVisible" class="secondary" type="button">Select visible</button>
      <button id="clearSelection" class="secondary" type="button">Clear</button>
      <button id="bulkPrimary" type="button"></button><div id="bulkMenu" class="action-menu"><button id="bulkMoreToggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="bulkMoreActions">More actions</button><div id="bulkMoreActions" role="menu"><button id="bulkInstall" type="button" role="menuitem">Install selected</button><button id="bulkUpdate" type="button" role="menuitem">Update selected</button><button id="bulkMigrate" type="button" role="menuitem">Migrate selected</button><button id="bulkHotload" type="button" role="menuitem">Hotload selected</button><button id="bulkOffload" type="button" role="menuitem">Offload selected</button><button id="bulkUninstall" class="danger" type="button" role="menuitem">Uninstall selected</button></div></div>
    </section>
    <section id="content"></section>
    </div>
    <section id="configurationSettings" class="configuration-settings" hidden aria-label="AI Marketplace configuration">
      <div class="configuration-section">
        <h2>Package Auto Update</h2>
        <p>When enabled, catalog refresh applies package updates for workspace and user-directory installs that are not rollback-pinned.</p>
        <div class="actions"><button id="packageAutoUpdate" class="toggle" type="button">Auto update</button></div>
      </div>
      <div class="configuration-section">
        <h2>Auto install by group</h2>
        <p>On each successful catalog refresh, missing global-deliverable packages in the selected groups are installed to the user directory.</p>
        <div id="groupChecklist" class="group-checklist" role="group" aria-label="Groups to auto-install"></div>
        <div class="actions"><button id="saveAutoGroups" type="button">Save selected</button><button id="clearAutoGroups" class="secondary" type="button">Clear</button></div>
      </div>
      <div class="configuration-section">
        <div class="configuration-heading"><h2>Repositories</h2><div class="actions"><button id="setRepositoryCredential" class="secondary" type="button">Set repository credential</button><button id="addRepository" type="button">Add repository</button></div></div>
        <p>Repositories are saved in VS Code User Settings and used across workspaces.</p>
        <div id="configuredRepositories" class="configured-repositories"></div>
        <form id="repositoryForm" class="repository-form" hidden>
          <h2 id="repositoryFormTitle">Add repository</h2>
          <div class="repository-form-grid">
            <label>Repository ID<input id="repositoryId" type="text" required maxlength="128" aria-describedby="repositoryIdHelp"><span id="repositoryIdHelp" class="meta">Used as the stable source identity.</span></label>
            <label>Label<input id="repositoryLabel" type="text" required></label>
            <label>Repository URL<input id="repositoryUrl" type="text" required placeholder="https://github.com/owner/repository"></label>
            <label>Provider<select id="repositoryProvider"><option value="">Infer from URL</option><option value="github">GitHub</option><option value="azure-devops">Azure DevOps</option><option value="gitlab">GitLab</option></select></label>
            <label>Branch<input id="repositoryBranch" type="text" required value="main"></label>
            <label class="checkbox-field"><input id="repositoryEnabled" type="checkbox" checked>Enabled</label>
            <label class="checkbox-field"><input id="repositoryAllowDefaults" type="checkbox">Allow default package installs</label>
          </div>
          <fieldset class="package-folder-fields"><legend>Package folders</legend>
            <label>Skills<input id="repositoryFolderSkill" type="text" required></label>
            <label>Commands<input id="repositoryFolderCommand" type="text" required></label>
            <label>MCPs<input id="repositoryFolderMcp" type="text" required></label>
            <label>Agents<input id="repositoryFolderAgent" type="text" required></label>
            <label>Hooks<input id="repositoryFolderHook" type="text" required></label>
            <label>Rules<input id="repositoryFolderRule" type="text" required></label>
          </fieldset>
          <div class="actions"><button type="submit">Save repository</button><button id="cancelRepository" class="secondary" type="button">Cancel</button></div>
        </form>
      </div>
    </section>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const model = ${data};
    const content = document.getElementById("content");
    const search = document.getElementById("search");
    const type = document.getElementById("type");
    const platform = document.getElementById("platform");
    const group = document.getElementById("group");
    const filterToggle = document.getElementById("filterToggle");
    const filterCount = document.getElementById("filterCount");
    const filterPanel = document.getElementById("filterPanel");
    const clearFilters = document.getElementById("clearFilters");
    const repositoryOptions = document.getElementById("repositoryOptions");
    const packageListUi = document.getElementById("packageListUi");
    const configurationSettings = document.getElementById("configurationSettings");
    const availableTab = document.getElementById("availableTab");
    const installedTab = document.getElementById("installedTab");
    const configurationTab = document.getElementById("configurationTab");
    const savedWebviewState = vscode.getState() || {};
    let activeTab = ["available", "installed", "configuration"].includes(savedWebviewState.activeTab) ? savedWebviewState.activeTab : "available";
    let editingRepositoryId;
    const selected = new Map();
    const selectedRepositories = new Set();
    const autoInstallGroupSet = new Set(Array.isArray(model.autoInstallGroups) ? model.autoInstallGroups : []);
    const repositories = [...new Map([...model.packages, ...model.installed].map((item) => [item.repositoryKey, item.sourceLabel])).entries()]
      .sort((left, right) => left[1].localeCompare(right[1]));
    repositoryOptions.innerHTML = repositories.length > 0
      ? repositories.map(([key, label]) => '<label class="repository-option"><input type="checkbox" value="' + escapeAttribute(key) + '"><span>' + escapeHtml(label) + '</span></label>').join("")
      : '<span class="meta">No repositories available</span>';
    const packageAutoUpdate = document.getElementById("packageAutoUpdate");
    packageAutoUpdate.textContent = model.autoUpdateEnabled ? "Auto update on" : "Auto update";
    packageAutoUpdate.classList.toggle("active", model.autoUpdateEnabled);
    packageAutoUpdate.addEventListener("click", () => vscode.postMessage({ command: "toggleAutoUpdate" }));
    document.getElementById("installGroup").addEventListener("click", () => vscode.postMessage({ command: "installByGroup" }));
    document.getElementById("refresh").addEventListener("click", () => vscode.postMessage({ command: "refresh" }));
    document.getElementById("setRepositoryCredential").addEventListener("click", () => vscode.postMessage({ command: "setRepositoryCredential" }));
    document.getElementById("saveAutoGroups").addEventListener("click", () => {
      const groups = [...configurationSettings.querySelectorAll('#groupChecklist input[type="checkbox"]:checked')].map((input) => input.value);
      vscode.postMessage({ command: "setAutoInstallGroups", groups });
    });
    document.getElementById("clearAutoGroups").addEventListener("click", () => {
      autoInstallGroupSet.clear();
      vscode.postMessage({ command: "setAutoInstallGroups", groups: [] });
    });
    document.getElementById("addRepository").addEventListener("click", () => openRepositoryForm());
    document.getElementById("cancelRepository").addEventListener("click", closeRepositoryForm);
    document.getElementById("repositoryForm").addEventListener("submit", (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      vscode.postMessage({ command: "saveRepository", originalId: editingRepositoryId, repository: repositoryFormValue() });
    });
    renderAutoSettings();
    renderConfiguredRepositories();
    search.addEventListener("input", render);
    type.addEventListener("change", render);
    platform.addEventListener("change", render);
    group.addEventListener("change", render);
    repositoryOptions.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedRepositories.add(checkbox.value); else selectedRepositories.delete(checkbox.value);
      render();
    }));
    filterToggle.addEventListener("click", () => {
      const expanded = filterToggle.getAttribute("aria-expanded") === "true";
      filterToggle.setAttribute("aria-expanded", String(!expanded));
      filterPanel.hidden = expanded;
    });
    filterPanel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        filterPanel.hidden = true;
        filterToggle.setAttribute("aria-expanded", "false");
        filterToggle.focus();
      }
    });
    clearFilters.addEventListener("click", () => {
      type.value = "";
      platform.value = "";
      group.value = "";
      selectedRepositories.clear();
      repositoryOptions.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => { checkbox.checked = false; });
      render();
    });
    availableTab.addEventListener("click", () => {
      activeTab = "available";
      vscode.setState({ activeTab });
      selected.clear();
      render();
    });
    installedTab.addEventListener("click", () => {
      activeTab = "installed";
      vscode.setState({ activeTab });
      selected.clear();
      render();
    });
    configurationTab.addEventListener("click", () => {
      activeTab = "configuration";
      vscode.setState({ activeTab });
      selected.clear();
      render();
    });
    document.getElementById("selectVisible").addEventListener("click", () => {
      visibleRows().forEach((row) => selected.set(selectionKey(row), row));
      render();
    });
    document.getElementById("clearSelection").addEventListener("click", () => { selected.clear(); render(); });
    document.getElementById("bulkInstall").addEventListener("click", () => runBulk("install"));
    document.getElementById("bulkUpdate").addEventListener("click", () => runBulk("update"));
    document.getElementById("bulkMigrate").addEventListener("click", () => runBulk("migrate"));
    document.getElementById("bulkUninstall").addEventListener("click", () => runBulk("uninstall"));
    document.getElementById("bulkHotload").addEventListener("click", () => runBulk("hotload"));
    document.getElementById("bulkOffload").addEventListener("click", () => runBulk("offload"));
    document.getElementById("bulkPrimary").addEventListener("click", (event) => runBulk(event.currentTarget.dataset.action));
    bindBulkMenu();

    function render() {
      availableTab.classList.toggle("active", activeTab === "available");
      installedTab.classList.toggle("active", activeTab === "installed");
      configurationTab.classList.toggle("active", activeTab === "configuration");
      availableTab.setAttribute("aria-selected", String(activeTab === "available"));
      installedTab.setAttribute("aria-selected", String(activeTab === "installed"));
      configurationTab.setAttribute("aria-selected", String(activeTab === "configuration"));
      const showPackages = activeTab !== "configuration";
      packageListUi.hidden = !showPackages;
      configurationSettings.hidden = showPackages;
      if (!showPackages) {
        document.querySelector(".bulk-actions").hidden = true;
        renderAutoSettings();
        renderConfiguredRepositories();
        return;
      }
      const query = search.value.trim().toLowerCase();
      const selectedType = type.value;
      const selectedGroup = group.value;
      const groups = [...new Set([...model.packages.map((pkg) => pkg.group), ...model.installed.map((item) => item.group)])].sort();
      group.innerHTML = '<option value="">All groups</option>' + groups.map((item) => '<option value="' + escapeAttribute(item) + '"' + (item === selectedGroup ? ' selected' : '') + '>' + escapeHtml(item) + '</option>').join("");
      const activeFilterCount = [selectedType, platform.value, group.value].filter(Boolean).length + (selectedRepositories.size > 0 ? 1 : 0);
      filterCount.textContent = activeFilterCount > 0 ? String(activeFilterCount) : "";
      clearFilters.disabled = activeFilterCount === 0;
      const packages = model.packages.filter((pkg) => {
        const haystack = [pkg.name, pkg.description, pkg.id, pkg.qualifiedName, pkg.group, pkg.sourceLabel, pkg.type, pkg.tags.join(" ")].join(" ").toLowerCase();
        return (!selectedType || pkg.type === selectedType)
          && (!platform.value || pkg.platforms.includes(platform.value))
          && (!group.value || pkg.group === group.value)
          && (selectedRepositories.size === 0 || selectedRepositories.has(pkg.repositoryKey))
          && (!query || haystack.includes(query));
      });
      const installedPackages = model.installed.filter((installed) => {
        const haystack = [
          installed.id,
          installed.type,
          installed.platform,
          installed.version,
          installed.installedPath,
          installed.name,
          installed.description,
          installed.qualifiedName,
          installed.group,
          installed.sourceLabel,
          installed.evaluationScore !== undefined ? "evaluation: " + installed.evaluationScore + "/10" : ""
        ].join(" ").toLowerCase();
        return (!selectedType || installed.type === selectedType)
          && (!platform.value || installed.platform === platform.value)
          && (!group.value || installed.group === group.value)
          && (selectedRepositories.size === 0 || selectedRepositories.has(installed.repositoryKey))
          && (!query || haystack.includes(query));
      }).sort((left, right) => Number(Boolean(right.updateAvailable)) - Number(Boolean(left.updateAvailable)));
      window.visibleRows = () => activeTab === "installed"
        ? installedPackages.map((item) => ({ kind: "installed", ...item }))
        : packages.map((item) => ({ kind: "available", ...item }));
      if (activeTab === "installed") {
        if (installedPackages.length === 0) {
          content.innerHTML = '<div class="empty">No installed packages found.</div>';
          updateBulkActions();
          return;
        }
        content.innerHTML = '<div class="grid">' + installedPackages.map(renderInstalledCard).join("") + '</div>';
        bindActions();
        bindSelection();
        updateBulkActions();
        return;
      }
      if (!model.configured) {
        content.innerHTML = '<div class="empty">Add a repository in the Configuration tab to load packages.</div>';
        updateBulkActions();
        return;
      }
      if (packages.length === 0) {
        content.innerHTML = '<div class="empty">No packages found.</div>';
        updateBulkActions();
        return;
      }
      content.innerHTML = '<div class="grid">' + packages.map(renderCard).join("") + '</div>';
      bindActions();
      bindSelection();
      updateBulkActions();
    }

    function renderAutoSettings() {
      packageAutoUpdate.textContent = model.autoUpdateEnabled ? "Auto update on" : "Auto update";
      packageAutoUpdate.classList.toggle("active", model.autoUpdateEnabled);
      const known = [...new Set([...(Array.isArray(model.knownGroups) ? model.knownGroups : []), ...autoInstallGroupSet])].sort((left, right) => left.localeCompare(right));
      const checklist = document.getElementById("groupChecklist");
      if (known.length === 0) {
        checklist.innerHTML = '<span class="meta">No package groups found. Refresh the catalog to discover groups.</span>';
      } else {
        checklist.innerHTML = known.map((name) => {
          const checked = autoInstallGroupSet.has(name) ? " checked" : "";
          return '<label class="group-option"><input type="checkbox" value="' + escapeAttribute(name) + '"' + checked + '><span>' + escapeHtml(name) + '</span></label>';
        }).join("");
        checklist.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => checkbox.addEventListener("change", () => {
          if (checkbox.checked) autoInstallGroupSet.add(checkbox.value); else autoInstallGroupSet.delete(checkbox.value);
        }));
      }
    }

    function renderConfiguredRepositories() {
      const container = document.getElementById("configuredRepositories");
      const repositories = Array.isArray(model.repositories) ? model.repositories : [];
      if (repositories.length === 0) {
        container.innerHTML = '<div class="empty">No repositories configured. Installed packages remain available offline.</div>';
      } else {
        container.innerHTML = repositories.map((repository) => '<div class="configured-repository">'
          + '<div class="repository-title"><strong>' + escapeHtml(repository.label) + '</strong><span class="chip">' + escapeHtml(repository.provider) + '</span></div>'
          + '<div class="meta">' + escapeHtml(repository.id + " - " + repository.url + " - " + repository.branch) + '</div>'
          + '<div class="meta">' + (repository.enabled ? "Enabled" : "Disabled") + (repository.allowDefaultPackages ? " - Default package installs allowed" : "") + '</div>'
          + '<div class="actions"><button class="secondary edit-repository" type="button" data-repository-id="' + escapeAttribute(repository.id) + '">Edit</button>'
          + '<button class="danger remove-repository" type="button" data-repository-id="' + escapeAttribute(repository.id) + '">Remove</button></div></div>').join("");
      }
      container.querySelectorAll("button.edit-repository").forEach((button) => button.addEventListener("click", () => {
        const repository = repositories.find((item) => item.id === button.dataset.repositoryId);
        if (repository) openRepositoryForm(repository);
      }));
      container.querySelectorAll("button.remove-repository").forEach((button) => button.addEventListener("click", () => {
        if (button.dataset.repositoryId) vscode.postMessage({ command: "removeRepository", repositoryId: button.dataset.repositoryId });
      }));
    }

    function openRepositoryForm(repository) {
      editingRepositoryId = repository?.id;
      const defaults = { skill: "Skills/", command: "Commands/", mcp: "Mcps/", agent: "Agents/", hook: "Hooks/", rule: "Rules/" };
      document.getElementById("repositoryFormTitle").textContent = repository ? "Edit repository" : "Add repository";
      document.getElementById("repositoryId").value = repository?.id || "";
      document.getElementById("repositoryId").disabled = Boolean(repository);
      document.getElementById("repositoryLabel").value = repository?.label || "";
      document.getElementById("repositoryUrl").value = repository?.url || "";
      document.getElementById("repositoryProvider").value = repository?.provider || "";
      document.getElementById("repositoryBranch").value = repository?.branch || "main";
      document.getElementById("repositoryEnabled").checked = repository ? repository.enabled : true;
      document.getElementById("repositoryAllowDefaults").checked = repository ? repository.allowDefaultPackages : false;
      for (const type of ["skill", "command", "mcp", "agent", "hook", "rule"]) {
        document.getElementById("repositoryFolder" + type.charAt(0).toUpperCase() + type.slice(1)).value = repository?.packageFolders?.[type] || defaults[type];
      }
      document.getElementById("repositoryForm").hidden = false;
      document.getElementById(repository ? "repositoryLabel" : "repositoryId").focus();
    }

    function closeRepositoryForm() {
      editingRepositoryId = undefined;
      document.getElementById("repositoryForm").hidden = true;
    }

    function repositoryFormValue() {
      const folder = (type) => document.getElementById("repositoryFolder" + type.charAt(0).toUpperCase() + type.slice(1)).value;
      return {
        id: document.getElementById("repositoryId").value,
        label: document.getElementById("repositoryLabel").value,
        url: document.getElementById("repositoryUrl").value,
        provider: document.getElementById("repositoryProvider").value,
        branch: document.getElementById("repositoryBranch").value,
        enabled: document.getElementById("repositoryEnabled").checked,
        allowDefaultPackages: document.getElementById("repositoryAllowDefaults").checked,
        packageFolders: Object.fromEntries(["skill", "command", "mcp", "agent", "hook", "rule"].map((type) => [type, folder(type)]))
      };
    }

    function bindActions() {
      content.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", () => vscode.postMessage({
          command: "packageAction",
          packageId: button.dataset.id,
          action: button.dataset.action,
          platform: button.dataset.platform || undefined,
          scope: button.dataset.scope || undefined,
          sourceId: button.dataset.sourceId,
          qualifiedName: button.dataset.qualifiedName,
          destinationSourceId: button.dataset.destinationSourceId || undefined,
          destinationQualifiedName: button.dataset.destinationQualifiedName || undefined,
          predecessorId: button.dataset.predecessorId || undefined,
          predecessorSourceId: button.dataset.predecessorSourceId || undefined,
          predecessorQualifiedName: button.dataset.predecessorQualifiedName || undefined
        }));
      });
      content.querySelectorAll("button[data-menu-toggle]").forEach((toggle) => toggle.addEventListener("click", () => {
        const wrapper = toggle.closest(".action-menu"); const open = !wrapper.classList.contains("open"); document.querySelectorAll(".action-menu.open").forEach((item) => { item.classList.remove("open"); item.querySelector("button[data-menu-toggle], #bulkMoreToggle").setAttribute("aria-expanded", "false"); }); wrapper.classList.toggle("open", open); toggle.setAttribute("aria-expanded", String(open)); if (open) wrapper.querySelector('[role="menuitem"]')?.focus();
      }));
      content.querySelectorAll('[role="menu"]').forEach((menu) => menu.addEventListener("keydown", (event) => { const items = [...menu.querySelectorAll('[role="menuitem"]')]; const index = items.indexOf(document.activeElement); if (event.key === "Escape") { const wrapper = menu.closest(".action-menu"); wrapper.classList.remove("open"); wrapper.querySelector("button[data-menu-toggle]").setAttribute("aria-expanded", "false"); wrapper.querySelector("button[data-menu-toggle]").focus(); event.preventDefault(); } if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length; items[next]?.focus(); event.preventDefault(); } }));
    }
    document.addEventListener("click", (event) => { if (!event.target.closest(".action-menu")) document.querySelectorAll(".action-menu.open").forEach((item) => { item.classList.remove("open"); item.querySelector("button[data-menu-toggle], #bulkMoreToggle").setAttribute("aria-expanded", "false"); }); });

    function visibleRows() { return window.visibleRows ? window.visibleRows() : []; }
    function selectionKey(row) {
      return row.kind + ":" + (row.sourceId || "legacy") + ":" + (row.qualifiedName || row.id) + ":" + (row.platform || "") + ":" + (row.scope || "");
    }
    function bindSelection() {
      content.querySelectorAll("button.select-package").forEach((button) => button.addEventListener("click", () => {
        const row = JSON.parse(button.dataset.row);
        const key = selectionKey(row);
        if (selected.has(key)) selected.delete(key); else selected.set(key, row);
        button.classList.toggle("selected", selected.has(key));
        button.setAttribute("aria-pressed", String(selected.has(key)));
        button.textContent = selected.has(key) ? "Selected" : "Select";
        updateBulkActions();
      }));
    }
    function updateBulkActions() {
      const rows = [...selected.values()].filter((row) => row.kind === activeTab);
      document.querySelector(".bulk-actions").hidden = rows.length === 0;
      document.getElementById("selectionCount").textContent = rows.length ? rows.length + " package(s) selected" : "No packages selected";
      const eligible = { install: rows.length > 0 && rows.every((row) => row.kind === "available") && rows.some((row) => row.installOptions.some((option) => option.scope === "workspace" || option.scope === "global")), update: rows.length > 0 && rows.every((row) => row.kind === "installed" && row.updateAvailable), migrate: rows.length > 0 && rows.every((row) => row.migration), hotload: rows.length > 0 && rows.every((row) => row.kind === "installed" && row.scope !== "cloud" && row.type !== "mcp" && row.installedPath.startsWith(".offload/")), offload: rows.length > 0 && rows.every((row) => row.kind === "installed" && row.scope !== "cloud" && row.type !== "mcp" && !row.installedPath.startsWith(".offload/")), uninstall: rows.length > 0 && rows.every((row) => row.kind === "installed") };
      const actions = ["install", "update", "migrate", "hotload", "offload", "uninstall"].filter((action) => eligible[action]); const primary = actions[0]; const primaryButton = document.getElementById("bulkPrimary"); primaryButton.hidden = !primary; primaryButton.dataset.action = primary || ""; primaryButton.textContent = primary ? ({ install: "Install selected", update: "Update selected", migrate: "Migrate selected", hotload: "Hotload selected", offload: "Offload selected", uninstall: "Uninstall selected" })[primary] : ""; ["install", "update", "migrate", "hotload", "offload", "uninstall"].forEach((action) => { const button = document.getElementById("bulk" + action.charAt(0).toUpperCase() + action.slice(1)); if (button) button.hidden = !eligible[action] || action === primary; }); document.getElementById("bulkMenu").hidden = actions.length < 2;
    }
    function bindBulkMenu() { const wrapper = document.getElementById("bulkMenu"); const toggle = document.getElementById("bulkMoreToggle"); const menu = document.getElementById("bulkMoreActions"); toggle.addEventListener("click", () => { const open = !wrapper.classList.contains("open"); wrapper.classList.toggle("open", open); toggle.setAttribute("aria-expanded", String(open)); if (open) menu.querySelector('[role="menuitem"]:not([hidden])')?.focus(); }); menu.addEventListener("keydown", (event) => { const items = [...menu.querySelectorAll('[role="menuitem"]:not([hidden])')]; const index = items.indexOf(document.activeElement); if (event.key === "Escape") { wrapper.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); toggle.focus(); } if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus(); event.preventDefault(); } }); }
    function runBulk(action) {
      const rows = [...selected.values()].filter((row) => row.kind === activeTab);
      const selections = rows.map((row) => {
        const preserveTarget = action !== "install" && action !== "uninstall";
        const migration = row.migration || {};
        return { action, packageId: row.id, sourceId: row.sourceId, qualifiedName: row.qualifiedName, platform: action === "uninstall" || preserveTarget ? (row.platform || migration.platform) : undefined, scope: preserveTarget ? (row.scope || migration.scope) : undefined, destinationSourceId: migration.destinationSourceId, destinationQualifiedName: migration.destinationQualifiedName, predecessorId: migration.predecessorId, predecessorSourceId: migration.predecessorSourceId, predecessorQualifiedName: migration.predecessorQualifiedName };
      });
      if (selections.length) vscode.postMessage({ command: "bulkPackageAction", selections });
    }

    function renderCard(pkg) {
      const installed = model.installed.filter((item) => item.sourceId === pkg.sourceId && item.qualifiedName === pkg.qualifiedName);
      const installedLocations = installed.length
        ? '<div class="install-locations" aria-label="Installed locations">' + installed.map((item) => '<span class="installation-location"><span>' + escapeHtml(platformLabel(item.platform) + " " + item.version + " " + installStateText(item)) + '</span>' + scopeBadge(item.scope) + '</span>').join("") + '</div>'
        : '<div class="meta">Not installed</div>';
      const scoreChip = pkg.evaluationScore === undefined ? "" : '<span class="chip">evaluation: ' + escapeHtml(pkg.evaluationScore + "/10") + '</span>';
      return \`
        <article>
          <div class="title-row"><button class="select-package \${selected.has(selectionKey({ kind: "available", ...pkg })) ? "selected" : ""}" data-row="\${escapeAttribute(JSON.stringify({ kind: "available", ...pkg }))}" type="button" aria-pressed="\${String(selected.has(selectionKey({ kind: "available", ...pkg })))}" aria-label="Select \${escapeAttribute(pkg.name)}">\${selected.has(selectionKey({ kind: "available", ...pkg })) ? "Selected" : "Select"}</button>
            <h2>\${escapeHtml(pkg.name)}</h2>
            <span class="version">\${escapeHtml(pkg.version)}</span>
          </div>
          <div class="meta">\${escapeHtml(pkg.type)} - \${escapeHtml(pkg.group)} - \${escapeHtml(pkg.sourceLabel)}</div>
          \${installedLocations}
          \${pkg.updateAvailable ? '<div class="chips"><span class="chip update">Update available</span></div>' : ''}
          <p class="description">\${escapeHtml(pkg.description)}</p>
          <div class="chips">\${scoreChip}\${pkg.tags.map((tag) => '<span class="chip">' + escapeHtml(tag) + '</span>').join("")}</div>
          \${cardActions(pkg)}
        </article>\`;
    }

    function cardActions(pkg) { const isAction = (action) => action && typeof action === "object" && typeof action.action === "string" && typeof action.label === "string"; const primary = isAction(pkg.primaryAction) ? actionButton(pkg.primaryAction, pkg, pkg.primaryAction.tone || "") : ""; const moreActions = (Array.isArray(pkg.moreActions) ? pkg.moreActions : []).filter(isAction); if (!primary && moreActions.length === 0) return ""; const more = moreActions.map((action) => actionButton(action, pkg, action.tone || "secondary", false, ' role="menuitem"')).join(""); const menuId = ("menu-" + (pkg.sourceId || "legacy") + "-" + (pkg.qualifiedName || pkg.id) + "-" + (pkg.platform || "catalog") + "-" + (pkg.scope || "catalog")).replace(/[^a-z0-9-]/gi, "-"); return '<div class="actions">' + primary + (moreActions.length > 0 ? '<div class="action-menu"><button data-menu-toggle type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="' + escapeAttribute(menuId) + '" aria-label="More actions for ' + escapeAttribute(pkg.name) + '">More actions</button><div id="' + escapeAttribute(menuId) + '" role="menu">' + more + '</div></div>' : "") + '</div>'; }

    function renderInstalledCard(installed) {
      const scoreChip = installed.evaluationScore !== undefined ? '<span class="chip">evaluation: ' + escapeHtml(installed.evaluationScore + "/10") + '</span>' : "";
      const status = installed.status.label;
      const versionText = installed.updateAvailable && installed.latestVersion
        ? installed.version + " -> " + installed.latestVersion
        : installed.version;
      return \`
        <article>
          <div class="title-row"><button class="select-package \${selected.has(selectionKey({ kind: "installed", ...installed })) ? "selected" : ""}" data-row="\${escapeAttribute(JSON.stringify({ kind: "installed", ...installed }))}" type="button" aria-pressed="\${String(selected.has(selectionKey({ kind: "installed", ...installed })))}" aria-label="Select \${escapeAttribute(installed.name)}">\${selected.has(selectionKey({ kind: "installed", ...installed })) ? "Selected" : "Select"}</button>
            <h2>\${escapeHtml(installed.name)}</h2>
            <span class="version">\${escapeHtml(versionText)}</span>
          </div>
          <div class="meta">\${escapeHtml(installed.platform)} - \${escapeHtml(status)} - \${escapeHtml(installed.group)} - \${escapeHtml(installed.sourceLabel)}</div>
          <div class="install-locations">\${scopeBadge(installed.scope)}</div>
          \${installed.updateAvailable ? '<div class="chips"><span class="chip update">Update available</span></div>' : ''}
          <p class="description">\${escapeHtml(installed.description)}</p>
          <div class="chips">\${scoreChip}\${installed.tags.map((tag) => '<span class="chip">' + escapeHtml(tag) + '</span>').join("")}</div>
          <div class="meta">\${escapeHtml(installed.installedPath)}</div>
          \${cardActions(installed)}
        </article>\`;
    }

    function installStateText(installed) {
      if (installed.scope === "cloud") {
        return "cloud";
      }
      return installed.installedPath.startsWith(".offload/") ? "offloaded" : "hotloaded";
    }

    function scopeBadge(scope) {
      const label = scope === "global" ? "User directory" : scope === "cloud" ? "Cloud" : "Workspace";
      return '<span class="chip scope-badge">' + escapeHtml(label) + '</span>';
    }

    function platformLabel(platform) {
      return platform === "codex" ? "Codex" : platform === "github-copilot" ? "GitHub Copilot" : platform === "claude" ? "Claude" : platform;
    }

    function actionButton(option, pkg, className, disabled, extra) {
      const cssClass = className ? ' class="' + escapeAttribute(className) + '"' : "";
      const selectedPlatform = option.action === "installDifferentPlatform" ? "" : (option.platform || "");
      const migration = pkg.migration || {};
      return '<button' + cssClass + ' data-action="' + escapeAttribute(option.action) + '" data-id="' + escapeAttribute(pkg.id) + '" data-source-id="' + escapeAttribute(pkg.sourceId || "") + '" data-qualified-name="' + escapeAttribute(pkg.qualifiedName) + '" data-platform="' + escapeAttribute(selectedPlatform) + '" data-scope="' + escapeAttribute(option.scope || "") + '" data-destination-source-id="' + escapeAttribute(migration.destinationSourceId || "") + '" data-destination-qualified-name="' + escapeAttribute(migration.destinationQualifiedName || "") + '" data-predecessor-id="' + escapeAttribute(migration.predecessorId || "") + '" data-predecessor-source-id="' + escapeAttribute(migration.predecessorSourceId || "") + '" data-predecessor-qualified-name="' + escapeAttribute(migration.predecessorQualifiedName || "") + '" type="button" ' + (extra || "") + ' ' + (disabled || option.disabled ? "disabled" : "") + '>' + escapeHtml(option.label || "Action") + '</button>';
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }
    function escapeAttribute(value) {
      return escapeHtml(value).replace(/\`/g, "&#96;");
    }
    render();
  </script>
</body>
</html>`;
}

function toSerializableModel(model: MarketplaceViewModel): unknown {
  return { ...toSerializableMarketplaceModel(model), repositories: model.repositories };
}

function createNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

function escapeHtmlText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function isAction(value: unknown): value is MarketplaceAction {
  return value === "install" || value === "installGlobal" || value === "installCloud" || value === "installDifferentPlatform" || value === "uninstall" || value === "update" || value === "migrate" || value === "revert" || value === "hotload" || value === "offload";
}

function isPlatform(value: unknown): value is Platform {
  return value === "codex" || value === "cursor" || value === "github-copilot" || value === "claude";
}

function isInstallScope(value: unknown): value is InstallScope {
  return value === "workspace" || value === "global" || value === "cloud";
}
