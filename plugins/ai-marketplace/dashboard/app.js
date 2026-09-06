const state = {
  view: "available",
  page: 1,
  pageSize: 20,
  model: null,
  rows: [],
  detailRow: null,
  selected: new Map(),
  currentPlan: null,
  csrfToken: "",
  loading: false,
  eventSource: null,
  reloadTimer: null,
  heartbeatTimer: null
};

const elements = {};
const lifecycleActions = new Set(["install", "update", "migrate", "revert", "uninstall", "hotload", "offload"]);

document.addEventListener("DOMContentLoaded", () => void initialize());

async function initialize() {
  for (const id of [
    "connection-status", "diagnose-button", "refresh-button", "offline-banner", "warning-banner",
    "available-count", "installed-count", "update-count", "search-filter", "type-filter", "group-filter",
    "source-filter", "scope-filter", "clear-filters", "updates-panel", "sync-button", "auto-update-toggle",
    "automatic-groups", "save-preferences", "source-action", "source-id", "source-url", "source-label",
    "source-provider", "source-branch", "source-enabled", "source-defaults", "source-folders", "review-source", "bulk-toolbar",
    "selected-count", "clear-selection", "results-title", "results-summary", "page-size", "package-results",
    "empty-state", "previous-page", "next-page", "page-status", "details-dialog", "details-title",
    "details-content", "plan-dialog", "plan-title", "plan-content", "confirm-plan", "diagnostics-dialog",
    "diagnostics-content", "progress-region", "progress-title", "progress-message", "progress-bar",
    "toast-region", "group-install-button", "marketplace-panel"
  ]) elements[id] = document.getElementById(id);

  bindEvents();
  try {
    await bootstrapSession();
    startHeartbeat();
    connectEvents();
    await loadModel();
  } catch (error) {
    renderLoadFailure(error);
  }
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
    tab.addEventListener("keydown", handleTabKeydown);
  });
  elements["search-filter"].addEventListener("input", debounce(resetAndLoad, 220));
  for (const id of ["type-filter", "group-filter", "source-filter", "scope-filter"]) {
    elements[id].addEventListener("change", () => {
      if (id === "group-filter") updateGroupInstallButton();
      resetAndLoad();
    });
  }
  elements["page-size"].addEventListener("change", () => {
    state.pageSize = Number(elements["page-size"].value);
    resetAndLoad();
  });
  elements["clear-filters"].addEventListener("click", clearFilters);
  elements["refresh-button"].addEventListener("click", () => void refreshCatalog());
  elements["diagnose-button"].addEventListener("click", () => void diagnose());
  elements["sync-button"].addEventListener("click", () => void requestPlan(syncRequest()));
  elements["save-preferences"].addEventListener("click", () => void planPreferences());
  elements["source-action"].addEventListener("change", updateSourceForm);
  elements["review-source"].addEventListener("click", () => void planSourceConfiguration());
  elements["group-install-button"].addEventListener("click", () => void planGroupInstall());
  elements["clear-selection"].addEventListener("click", clearSelection);
  elements["previous-page"].addEventListener("click", () => changePage(-1));
  elements["next-page"].addEventListener("click", () => changePage(1));
  elements["confirm-plan"].addEventListener("click", () => void applyCurrentPlan());
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog)?.close());
  });
  document.querySelectorAll("[data-bulk-action]").forEach((button) => {
    button.addEventListener("click", () => void planBulkLifecycle(button.dataset.bulkAction));
  });
  document.body.addEventListener("click", handleDelegatedClick);
  document.body.addEventListener("change", handleDelegatedChange);
  document.body.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeActionMenus();
  });
  updateSourceForm();
}

async function bootstrapSession() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const dashboardToken = fragment.get("token");
  if (!dashboardToken) throw new Error("This dashboard link is missing its one-time session token. Open it again from Codex.");
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  const response = await fetch("/api/bootstrap", {
    method: "POST",
    headers: { Accept: "application/json", "X-Dashboard-Token": dashboardToken }
  });
  const payload = await readJsonResponse(response);
  const data = payload.data ?? payload;
  if (!response.ok || payload.ok === false) throw new Error(payload.error?.message ?? payload.message ?? `Bootstrap failed (${response.status}).`);
  if (typeof data.csrfToken !== "string" || !data.csrfToken) throw new Error("Dashboard bootstrap did not return a CSRF token.");
  state.csrfToken = data.csrfToken;
}

async function loadModel(options = {}) {
  if (state.loading) return;
  state.loading = true;
  elements["package-results"].setAttribute("aria-busy", "true");
  try {
    const params = new URLSearchParams({
      tab: state.view,
      page: String(state.page),
      pageSize: String(state.pageSize)
    });
    addParam(params, "search", elements["search-filter"].value.trim());
    addParam(params, "type", elements["type-filter"].value);
    addParam(params, "group", elements["group-filter"].value);
    addParam(params, "sourceId", elements["source-filter"].value);
    if (state.view !== "available") addParam(params, "scope", elements["scope-filter"].value);
    const model = await api(`/api/model?${params.toString()}`);
    assertDashboardModel(model);
    state.model = model;
    state.rows = model.rows;
    renderModel(model, options);
  } catch (error) {
    renderLoadFailure(error);
  } finally {
    state.loading = false;
    elements["package-results"].setAttribute("aria-busy", "false");
  }
}

function assertDashboardModel(model) {
  if (model?.schemaVersion !== 1 || model.platform !== "codex" || model.tab !== state.view || !Array.isArray(model.rows)) {
    throw new Error("Server returned an unsupported dashboard model.");
  }
}

function renderModel(model, options) {
  fillSelect(elements["type-filter"], model.facets.types, "All types");
  fillSelect(elements["group-filter"], model.facets.groups, "All groups");
  fillSelect(elements["source-filter"], model.facets.sources, "All sources");
  renderCounts(model.counts);
  renderConnection(model.refresh);
  renderWarnings(model.refresh.warnings, model.configured);
  renderPreferences(model.preferences, model.knownGroups);
  renderPackages(state.rows);
  renderPagination(model.pagination);
  updateBulkToolbar();
  updateGroupInstallButton();
  if (options.announce) toast(options.announce);
}

function renderPackages(rows) {
  elements["package-results"].replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const row of rows) fragment.append(packageCard(row));
  elements["package-results"].append(fragment);
  const empty = rows.length === 0;
  elements["empty-state"].classList.toggle("hidden", !empty);
  elements["package-results"].classList.toggle("hidden", empty);
  elements["results-title"].textContent = state.view === "installed"
    ? "Installed packages"
    : state.view === "updates" ? "Update candidates" : "Available packages";
  const filterSummary = activeFilterCount() ? ` · ${activeFilterCount()} filters active` : "";
  elements["results-summary"].textContent = `${state.model.pagination.totalItems} ${state.model.pagination.totalItems === 1 ? "package" : "packages"}${filterSummary}`;
}

function packageCard(row) {
  const identity = identityOf(row);
  const rowKey = keyOf(row);
  const article = el("article", "package-card");
  article.dataset.identity = identity;
  article.dataset.rowKey = rowKey;
  const checkbox = el("input", "card-select");
  checkbox.type = "checkbox";
  checkbox.checked = state.selected.has(rowKey);
  checkbox.dataset.selectRow = rowKey;
  checkbox.setAttribute("aria-label", `Select ${row.name}`);
  article.append(checkbox);

  const heading = el("div", "card-heading");
  const icon = el("div", "package-icon", row.type.slice(0, 2));
  const titleBlock = el("div");
  titleBlock.append(el("h3", "", row.name), el("div", "qualified-name", row.qualifiedName), el("div", "source-line", row.sourceLabel));
  heading.append(icon, titleBlock);
  article.append(heading);

  const badges = el("div", "card-badges");
  badges.append(badge(row.type));
  if (row.group) badges.append(badge(row.group));
  if (row.kind === "installed") badges.append(badge(scopeLabel(row.scope), "installed"));
  badges.append(badge(row.status.label, row.updateAvailable ? "update" : row.kind === "installed" ? "installed" : ""));
  article.append(badges, el("p", "package-description", row.description || "No description provided."));

  const footer = el("div", "card-footer");
  footer.append(el("span", "version", versionLabel(row)));
  const actionArea = el("div");
  const actions = actionsOf(row);
  const primary = actions[0];
  if (primary) actionArea.append(actionButton(primary, row, "primary"));
  if (actions.length > 1) {
    const menuButton = el("button", "button secondary small", "More");
    menuButton.type = "button";
    menuButton.dataset.menuFor = rowKey;
    menuButton.setAttribute("aria-expanded", "false");
    actionArea.append(menuButton);
    const menu = el("div", "action-menu hidden");
    menu.dataset.actionMenu = rowKey;
    for (const action of actions.slice(1)) menu.append(actionButton(action, row, "menu"));
    article.append(menu);
  }
  const details = el("button", "button ghost small", "Details");
  details.type = "button";
  details.dataset.detailsRow = rowKey;
  actionArea.prepend(details);
  footer.append(actionArea);
  article.append(footer);
  return article;
}

function actionButton(action, row, presentation) {
  const button = el("button", presentation === "menu" ? "" : `button ${action.tone === "danger" ? "danger" : presentation === "primary" ? "primary" : "secondary"} small`, action.label);
  button.type = "button";
  const normalizedAction = normalizeLifecycleAction(action.action);
  button.disabled = action.disabled === true || !normalizedAction;
  if (normalizedAction) button.dataset.planAction = normalizedAction;
  button.dataset.planRow = keyOf(row);
  button.dataset.planScope = action.scope ?? (row.kind === "installed" ? row.scope : "");
  if (action.tone === "danger") button.dataset.destructive = "true";
  return button;
}

async function showDetails(rowKey) {
  const row = rowByKey(rowKey);
  if (!row) return;
  elements["details-title"].textContent = row.name;
  elements["details-content"].replaceChildren(detailLoading());
  elements["details-dialog"].showModal();
  try {
    const detailQuery = new URLSearchParams({ kind: row.kind });
    if (row.kind === "installed") detailQuery.set("scope", row.scope);
    const detail = await api(`/api/packages/${encodeURIComponent(row.sourceId ?? "legacy")}/${encodeURIComponent(row.qualifiedName)}?${detailQuery.toString()}`);
    renderDetails(detail.row);
  } catch (error) {
    elements["details-content"].replaceChildren(errorBlock(error));
  }
}

function renderDetails(row) {
  state.detailRow = row;
  const container = document.createDocumentFragment();
  const summary = el("section", "detail-section");
  summary.append(el("p", "", row.description || "No description provided."));
  const badges = el("div", "card-badges");
  for (const tag of row.tags) badges.append(badge(tag));
  summary.append(badges);
  container.append(summary);

  const metadata = el("section", "detail-section");
  metadata.append(el("h3", "", "Package information"));
  const list = el("dl", "metadata-list");
  for (const [label, value] of [
    ["Identity", identityOf(row)], ["Source", row.sourceLabel], ["Version", row.version], ["Type", row.type],
    ["Group", row.group], ["Scope", row.kind === "installed" ? scopeLabel(row.scope) : undefined],
    ["Installed path", row.kind === "installed" ? row.installedPath : undefined],
    ["Revision", row.kind === "installed" ? row.sourceRevision : undefined]
  ]) if (value !== undefined && value !== "") list.append(el("dt", "", label), el("dd", "", String(value)));
  metadata.append(list);
  container.append(metadata);

  const actions = el("section", "detail-section");
  actions.append(el("h3", "", "Actions"));
  const actionRow = el("div", "dialog-actions");
  for (const action of actionsOf(row)) actionRow.append(actionButton(action, row, action.tone === "primary" ? "primary" : "secondary"));
  if (!actionRow.children.length) actionRow.append(el("p", "", "No actions are currently eligible."));
  actions.append(actionRow);
  container.append(actions);
  elements["details-content"].replaceChildren(container);
}

function planLifecycle(action, rows, scope) {
  const normalizedAction = normalizeLifecycleAction(action);
  if (!normalizedAction) {
    toast("This package action is not supported by the Codex dashboard.", true);
    return Promise.resolve();
  }
  const identities = rows.map(identityOf);
  if (!identities.length) return Promise.resolve();
  const request = { action: normalizedAction, identities };
  if (scope === "workspace" || scope === "global") request.scope = scope;
  return requestPlan(request);
}

function planBulkLifecycle(action) {
  const rows = [...state.selected.values()];
  let scope = currentScope();
  if (!scope) {
    const scopes = [...new Set(rows.filter((row) => row.kind === "installed").map((row) => row.scope))];
    if (scopes.length > 1) {
      toast("Choose a workspace or global scope before planning a mixed-scope bulk action.", true);
      return Promise.resolve();
    }
    scope = scopes[0];
  }
  return planLifecycle(action, rows, scope);
}

function planGroupInstall() {
  const group = elements["group-filter"].value;
  if (!group) return Promise.resolve();
  return requestPlan({ action: "install-group", group, scope: currentScope() ?? "workspace" });
}

function syncRequest() {
  const scope = currentScope();
  return scope ? { action: "sync", scope } : { action: "sync" };
}

function planPreferences() {
  const groups = [...elements["automatic-groups"].querySelectorAll("input:checked")].map((input) => input.value);
  return requestPlan({
    action: "set-preferences",
    autoUpdate: elements["auto-update-toggle"].checked,
    autoInstallGroups: groups
  });
}

function planSourceConfiguration() {
  const action = elements["source-action"].value;
  const sourceId = elements["source-id"].value.trim();
  if (!sourceId) return toast("Source ID is required.", true);
  if (action === "source-remove") return requestPlan({ action, sourceId });
  const url = elements["source-url"].value.trim();
  if (!url) return toast("Repository URL is required.", true);
  const source = { id: sourceId, url };
  addOptional(source, "provider", elements["source-provider"].value);
  addOptional(source, "label", elements["source-label"].value.trim());
  addOptional(source, "branch", elements["source-branch"].value.trim());
  source.enabled = elements["source-enabled"].checked;
  source.allowDefaultPackages = elements["source-defaults"].checked;
  const folders = parsePackageFolders(elements["source-folders"].value);
  if (folders === null) return;
  if (Object.keys(folders).length) source.packageFolders = folders;
  return requestPlan({ action, source });
}

function parsePackageFolders(text) {
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    const allowed = new Set(["skill", "command", "mcp", "agent", "hook", "rule"]);
    if (Object.entries(value).some(([key, path]) => !allowed.has(key) || typeof path !== "string" || !path.trim())) throw new Error();
    return value;
  } catch {
    toast("Package folders must be a JSON object using package types and string paths.", true);
    return null;
  }
}

async function requestPlan(request) {
  closeActionMenus();
  try {
    setProgress(true, "Preparing plan", "Checking eligibility and exact paths…");
    const plan = await api("/api/plans", { method: "POST", body: request });
    assertDashboardPlan(plan);
    state.currentPlan = plan;
    renderPlan(plan);
  } catch (error) {
    toast(messageOf(error), true);
  } finally {
    setProgress(false);
  }
}

function assertDashboardPlan(plan) {
  if (plan?.schemaVersion !== 1
    || typeof plan.planId !== "string"
    || !Array.isArray(plan.items)
    || !Array.isArray(plan.skipped)
    || !Array.isArray(plan.ineligible)
    || plan.items.some((item) => item.kind === "configuration" && !Array.isArray(item.changes))) {
    throw new Error("Server returned an unsupported operation plan.");
  }
}

function renderPlan(plan) {
  elements["plan-title"].textContent = `Review ${labelForAction(plan.action)}`;
  const content = document.createDocumentFragment();
  const summary = el("div", `plan-summary${plan.destructive ? " destructive" : ""}`);
  summary.append(el("strong", "", `${plan.items.length} planned ${plan.items.length === 1 ? "item" : "items"}`));
  if (plan.destructive) summary.append(el("p", "", "This plan removes or replaces managed data or executes package-supplied code with your user privileges. Review every path before confirming."));
  content.append(summary);

  appendPlanItems(content, plan.items);
  appendPlanIssueSection(content, "Skipped", plan.skipped);
  appendPlanIssueSection(content, "Ineligible", plan.ineligible);
  const expiry = el("section", "plan-section");
  expiry.append(el("h3", "", "Plan expiry"), el("p", "", new Date(plan.expiresAt).toLocaleString()));
  content.append(expiry);
  const hasIneligible = plan.ineligible.length > 0;
  if (hasIneligible) {
    const blocked = el("div", "banner warning");
    blocked.append(el("strong", "", "This plan cannot be applied."), document.createTextNode(" Remove ineligible selections and create a new plan."));
    content.append(blocked);
  }
  elements["plan-content"].replaceChildren(content);
  elements["confirm-plan"].disabled = !plan.planId || plan.items.length === 0 || hasIneligible;
  elements["confirm-plan"].className = `button ${plan.destructive ? "danger" : "primary"}`;
  elements["confirm-plan"].textContent = plan.destructive ? "Confirm destructive action" : "Confirm and apply";
  elements["plan-dialog"].showModal();
}

function appendPlanItems(parent, items) {
  if (!items.length) return;
  const section = el("section", "plan-section");
  section.append(el("h3", "", `Planned items (${items.length})`));
  const list = el("ol", "plan-list plan-items");
  for (const item of items) {
    const entry = el("li", "plan-item");
    const title = item.kind === "package"
      ? `${labelForAction(item.action)} ${item.identity} · ${scopeLabel(item.scope)}`
      : item.summary;
    entry.append(el("strong", "", title));
    if (item.kind === "package" && (item.version || item.targetVersion)) {
      entry.append(el("span", "plan-version", planVersionLabel(item)));
    }
    if (item.kind === "configuration") {
      const changes = el("dl", "configuration-changes");
      for (const change of item.changes) {
        changes.append(
          el("dt", "", change.field),
          el("dd", "", `${reviewValue(change.before)} → ${reviewValue(change.after)}`)
        );
      }
      entry.append(changes);
    }
    const paths = el("ul", "path-list");
    for (const affected of item.paths) {
      paths.append(el("li", "", `${scopeLabel(affected.scope)} · ${humanize(affected.effect)} · ${affected.path}`));
    }
    if (item.paths.length) entry.append(paths);
    list.append(entry);
  }
  section.append(list);
  parent.append(section);
}

function appendPlanIssueSection(parent, title, items) {
  if (!items.length) return;
  const section = el("section", "plan-section");
  section.append(el("h3", "", `${title} (${items.length})`));
  const list = el("ul", "plan-list");
  for (const item of items) list.append(el("li", "", `${item.identity}: ${item.reason}`));
  section.append(list);
  parent.append(section);
}

async function applyCurrentPlan() {
  const plan = state.currentPlan;
  if (!plan?.planId) return;
  elements["confirm-plan"].disabled = true;
  setProgress(true, "Applying reviewed plan", "Waiting for progress…", 0);
  try {
    const result = await api(`/api/plans/${encodeURIComponent(plan.planId)}/apply`, { method: "POST", body: {} });
    elements["plan-dialog"].close();
    state.currentPlan = null;
    clearSelection();
    const failures = Array.isArray(result.failures) ? result.failures : [];
    toast(result.applied ? `${result.count} planned ${result.count === 1 ? "item" : "items"} applied.${failures.length ? ` ${failures.length} failed: ${failures.map((item) => item.identity).join(", ")}.` : ""}` : "The plan was not applied.", !result.applied || failures.length > 0);
    await loadModel();
  } catch (error) {
    elements["plan-dialog"].close();
    state.currentPlan = null;
    clearSelection();
    toast(`${messageOf(error)} Create and review a new plan before retrying.`, true);
    await loadModel();
  } finally {
    setProgress(false);
  }
}

async function refreshCatalog() {
  elements["refresh-button"].disabled = true;
  setProgress(true, "Refreshing catalog", "Contacting configured sources…");
  try {
    await api("/api/refresh", { method: "POST", body: {} });
    await loadModel({ announce: "Catalog refreshed." });
  } catch (error) {
    toast(messageOf(error), true);
    await loadModel();
  } finally {
    elements["refresh-button"].disabled = false;
    setProgress(false);
  }
}

async function diagnose() {
  elements["diagnostics-content"].replaceChildren(detailLoading());
  elements["diagnostics-dialog"].showModal();
  try {
    const result = await api("/api/diagnose", { method: "POST", body: {} });
    const list = el("dl", "metadata-list");
    for (const [key, value] of Object.entries(result.diagnostics ?? result)) {
      if (value === undefined || key.toLowerCase().includes("token")) continue;
      list.append(el("dt", "", humanize(key)), el("dd", "", printable(value)));
    }
    elements["diagnostics-content"].replaceChildren(list);
  } catch (error) {
    elements["diagnostics-content"].replaceChildren(errorBlock(error));
  }
}

function startHeartbeat() {
  window.clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = window.setInterval(() => {
    if (document.visibilityState !== "hidden") void sendHeartbeat();
  }, 60_000);
}

async function sendHeartbeat() {
  try {
    await api("/api/heartbeat", { method: "POST", body: {} });
  } catch {
    setConnection("Reconnecting", "offline");
  }
}

function connectEvents() {
  if (!("EventSource" in window)) return;
  const source = new EventSource("/api/events");
  state.eventSource = source;
  source.addEventListener("open", () => setConnection("Connected", "online"));
  source.addEventListener("error", () => setConnection("Reconnecting", "offline"));
  for (const type of ["ready", "catalog", "state", "operation", "heartbeat"]) {
    source.addEventListener(type, (event) => handleServerEvent(type, event));
  }
}

function handleServerEvent(type, event) {
  let payload = {};
  try { payload = event.data ? JSON.parse(event.data) : {}; } catch { return; }
  if (type === "ready" || type === "heartbeat") {
    setConnection("Connected", "online");
  } else if (type === "catalog" || type === "state") {
    scheduleReload();
  } else if (type === "operation") {
    const status = payload.status;
    if (status === "applied" || status === "rejected") {
      setProgress(false);
      toast(status === "rejected" ? "Marketplace operation was rejected." : "Marketplace operation completed.", status === "rejected");
      scheduleReload();
    } else if (status === "applying") {
      setProgress(true, "Applying reviewed plan", `Applying ${payload.planId}…`);
    }
  }
}

function handleDelegatedClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "clear-filters") clearFilters();
  if (button.dataset.detailsRow) void showDetails(button.dataset.detailsRow);
  if (button.dataset.menuFor) toggleActionMenu(button);
  if (button.dataset.planAction) {
    const row = rowByKey(button.dataset.planRow);
    if (row) void planLifecycle(button.dataset.planAction, [row], button.dataset.planScope || undefined);
  }
}

function handleDelegatedChange(event) {
  const input = event.target;
  if (input.matches("[data-select-row]")) {
    const row = rowByKey(input.dataset.selectRow);
    if (input.checked && row) state.selected.set(input.dataset.selectRow, row);
    else state.selected.delete(input.dataset.selectRow);
    updateBulkToolbar();
  }
}

function renderCounts(counts) {
  elements["available-count"].textContent = String(counts.available);
  elements["installed-count"].textContent = String(counts.installed);
  elements["update-count"].textContent = String(counts.updates);
}

function renderConnection(refresh) {
  const offline = refresh.state === "offline";
  elements["offline-banner"].classList.toggle("hidden", !offline);
  const label = refresh.state === "online" ? "Connected" : refresh.state === "partial" ? "Partial catalog" : "Installed offline";
  setConnection(label, offline ? "offline" : refresh.state === "partial" ? "partial" : "online");
}

function renderWarnings(warnings, configured) {
  const messages = configured ? [...warnings] : ["No marketplace source is configured.", ...warnings];
  elements["warning-banner"].classList.toggle("hidden", messages.length === 0);
  elements["warning-banner"].textContent = messages.join(" · ");
}

function renderPreferences(preferences, knownGroups) {
  elements["auto-update-toggle"].checked = preferences.autoUpdate;
  const selected = new Set(preferences.autoInstallGroups);
  const fragment = document.createDocumentFragment();
  for (const group of knownGroups) {
    const label = el("label");
    const input = el("input");
    input.type = "checkbox";
    input.value = group;
    input.checked = selected.has(group);
    label.append(input, document.createTextNode(group));
    fragment.append(label);
  }
  if (!knownGroups.length) fragment.append(el("span", "source-line", "No groups are currently known."));
  elements["automatic-groups"].replaceChildren(fragment);
}

function renderPagination(pagination) {
  state.page = pagination.page;
  elements["page-status"].textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
  elements["previous-page"].disabled = pagination.page <= 1;
  elements["next-page"].disabled = pagination.page >= pagination.totalPages;
}

function renderLoadFailure(error) {
  setConnection("Unavailable", "offline");
  elements["offline-banner"]?.classList.remove("hidden");
  elements["package-results"]?.replaceChildren(errorBlock(error));
  if (elements["results-summary"]) elements["results-summary"].textContent = "Unable to load marketplace state";
  toast(messageOf(error), true);
}

function setView(view) {
  state.view = view;
  state.page = 1;
  clearSelection();
  document.querySelectorAll("[data-view]").forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  elements["marketplace-panel"].setAttribute("aria-labelledby", `${view}-tab`);
  elements["updates-panel"].classList.toggle("hidden", view !== "updates");
  void loadModel();
}

function updateBulkToolbar() {
  elements["selected-count"].textContent = String(state.selected.size);
  elements["bulk-toolbar"].classList.toggle("hidden", state.selected.size === 0);
  const rows = [...state.selected.values()];
  const scope = currentScope();
  document.querySelectorAll("[data-bulk-action]").forEach((button) => {
    const eligible = rows.filter((row) => rowSupportsAction(row, button.dataset.bulkAction, scope)).length;
    button.disabled = rows.length === 0 || eligible !== rows.length;
    button.title = rows.length === 0
      ? "Select packages first."
      : eligible === rows.length
        ? `${eligible} selected packages are eligible.`
        : `${eligible} of ${rows.length} selected packages are eligible; refine the selection or scope.`;
  });
}

function updateGroupInstallButton() {
  const group = elements["group-filter"].value;
  elements["group-install-button"].classList.toggle("hidden", !group || state.view !== "available");
  elements["group-install-button"].textContent = group ? `Install ${group}` : "Install group";
}

function updateSourceForm() {
  const removing = elements["source-action"].value === "source-remove";
  for (const id of ["source-url", "source-provider", "source-label", "source-branch", "source-enabled", "source-defaults", "source-folders"]) {
    elements[id].disabled = removing;
  }
  elements["review-source"].textContent = removing ? "Review source removal" : "Review source changes";
}

function clearSelection() {
  state.selected.clear();
  document.querySelectorAll("[data-select-row]").forEach((input) => { input.checked = false; });
  updateBulkToolbar();
}

function clearFilters() {
  elements["search-filter"].value = "";
  for (const id of ["type-filter", "group-filter", "source-filter", "scope-filter"]) elements[id].value = "";
  updateGroupInstallButton();
  resetAndLoad();
}

function resetAndLoad() { state.page = 1; clearSelection(); void loadModel(); }
function changePage(delta) { state.page = Math.max(1, state.page + delta); clearSelection(); void loadModel(); }
function currentScope() { return elements["scope-filter"].value || (state.view === "available" ? "workspace" : undefined); }

function toggleActionMenu(button) {
  const identity = button.dataset.menuFor;
  document.querySelectorAll("[data-action-menu]").forEach((menu) => {
    menu.classList.toggle("hidden", menu.dataset.actionMenu !== identity || !menu.classList.contains("hidden"));
  });
  const menu = document.querySelector(`[data-action-menu="${CSS.escape(identity)}"]`);
  const open = Boolean(menu && !menu.classList.contains("hidden"));
  button.setAttribute("aria-expanded", String(open));
}

function closeActionMenus() {
  document.querySelectorAll("[data-action-menu]").forEach((menu) => menu.classList.add("hidden"));
}

function setProgress(visible, title = "", message = "", percent) {
  elements["progress-region"].classList.toggle("hidden", !visible);
  if (!visible) return;
  elements["progress-title"].textContent = title;
  elements["progress-message"].textContent = message;
  if (Number.isFinite(percent)) elements["progress-bar"].value = Math.max(0, Math.min(100, percent));
  else elements["progress-bar"].removeAttribute("value");
}

function setConnection(label, status) {
  elements["connection-status"].textContent = label;
  elements["connection-status"].className = `status-pill ${status}`;
}

function toast(text, error = false) {
  const item = el("div", `toast${error ? " error" : ""}`, text);
  elements["toast-region"].replaceChildren(item);
  window.setTimeout(() => item.remove(), 5000);
}

function scheduleReload() {
  window.clearTimeout(state.reloadTimer);
  state.reloadTimer = window.setTimeout(() => void loadModel(), 180);
}

async function api(path, options = {}) {
  const method = options.method ?? "GET";
  const headers = { Accept: "application/json" };
  if (method !== "GET") {
    if (!state.csrfToken) throw new Error("Dashboard session is not initialized.");
    headers["X-CSRF-Token"] = state.csrfToken;
  }
  const init = { method, headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  const payload = await readJsonResponse(response);
  if (!response.ok || payload.ok === false) throw new Error(payload.error?.message ?? payload.message ?? `Request failed (${response.status}).`);
  return payload.data ?? payload;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw new Error(`Server returned invalid JSON (${response.status}).`); }
}

function actionsOf(row) {
  return [row.primaryAction, ...row.moreActions].filter(Boolean);
}

function rowSupportsAction(row, action, scope) {
  return actionsOf(row).some((candidate) => {
    if (candidate.disabled || normalizeLifecycleAction(candidate.action) !== action) return false;
    return !scope || !candidate.scope || candidate.scope === scope;
  });
}

function normalizeLifecycleAction(action) {
  const normalized = ["installGlobal", "installDifferentPlatform"].includes(action) ? "install" : action;
  return lifecycleActions.has(normalized) ? normalized : "";
}

function identityOf(row) { return `${row.sourceId ?? "legacy"}:${row.qualifiedName}`; }
function keyOf(row) { return row.kind === "installed" ? `${identityOf(row)}::${row.scope}` : identityOf(row); }
function rowByKey(key) {
  return state.rows.find((row) => keyOf(row) === key)
    ?? (state.detailRow && keyOf(state.detailRow) === key ? state.detailRow : undefined);
}
function versionLabel(row) { return row.latestVersion && row.latestVersion !== row.version ? `${row.version} → ${row.latestVersion}` : `v${row.version}`; }
function planVersionLabel(item) {
  if (item.action === "install") return `${item.version ?? "not installed"} → ${item.targetVersion ?? "installed"}`;
  if (item.action === "uninstall") return `${item.version ?? "installed"} → removed`;
  if (item.action === "hotload" || item.action === "offload") return item.version ? `Version ${item.version}` : humanize(item.action);
  if (item.action === "revert") return item.targetVersion ? `${item.version ?? "current"} → ${item.targetVersion}` : `${item.version ?? "current"} → previous declared revision`;
  return `${item.version ?? "current"} → ${item.targetVersion ?? "latest"}`;
}
function reviewValue(value) { return value === undefined ? "not set" : JSON.stringify(value); }
function scopeLabel(value) { return value === "global" ? "User profile" : value === "workspace" ? "Workspace" : String(value ?? ""); }
function labelForAction(action = "") {
  return ({
    install: "Install", update: "Update", revert: "Revert", uninstall: "Uninstall", hotload: "Hotload",
    offload: "Offload", sync: "Synchronize", "install-group": "Install group", "set-preferences": "Update preferences",
    "source-add": "Add source", "source-update": "Update source", "source-remove": "Remove source"
  })[action] ?? humanize(action);
}

function fillSelect(select, values, firstLabel) {
  const current = select.value;
  const fragment = document.createDocumentFragment();
  const first = el("option", "", firstLabel);
  first.value = "";
  fragment.append(first);
  for (const item of normalizeOptions(values)) {
    const option = el("option", "", item.label);
    option.value = item.value;
    fragment.append(option);
  }
  select.replaceChildren(fragment);
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function normalizeOptions(values) {
  return values.map((value) => typeof value === "string"
    ? { value, label: value }
    : { value: value.value ?? value.id, label: value.label ?? value.value ?? value.id })
    .filter((item) => item.value);
}

function activeFilterCount() {
  return [elements["search-filter"].value, elements["type-filter"].value, elements["group-filter"].value, elements["source-filter"].value, elements["scope-filter"].value].filter(Boolean).length;
}

function addParam(params, name, value) { if (value) params.set(name, value); }
function addOptional(target, name, value) { if (value) target[name] = value; }
function badge(text, variant = "") { return el("span", `badge ${variant}`.trim(), text); }
function detailLoading() { return el("p", "source-line", "Loading…"); }
function errorBlock(error) {
  const block = el("div", "banner warning");
  block.append(el("strong", "", "Unable to complete request"), document.createTextNode(` ${messageOf(error)}`));
  return block;
}
function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function humanize(value) { return String(value ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase()); }
function printable(value) { return typeof value === "string" ? value : JSON.stringify(value); }
function messageOf(error) { return error instanceof Error ? error.message : String(error); }
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function handleTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...document.querySelectorAll("[data-view]")];
  const current = tabs.indexOf(event.currentTarget);
  const next = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[next].focus();
  tabs[next].click();
}
