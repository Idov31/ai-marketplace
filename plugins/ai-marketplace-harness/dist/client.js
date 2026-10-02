globalThis.__ModuleLoader__.load({
  id: "ai-marketplace-harness",
  factory(require) {
    const React = require("react");
    const h = React.createElement;
    const tabId = "ai-marketplace-harness";

    function MarketplacePage({ sessionId } = {}) {
      const [data, setData] = React.useState(null);
      const [profile, setProfile] = React.useState(() => localStorage.getItem("aiMarketplace.profile") || "web");
      const [tab, setTab] = React.useState("available");
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState("");
      const [search, setSearch] = React.useState("");
      async function request(action, details = {}) {
        const response = await fetch("/ai-marketplace/api", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, profile, sessionId, ...details })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Marketplace request failed.");
        return result;
      }
      async function load(refresh) {
        setBusy(true);
        setError("");
        try {
          const result = await request(refresh ? "refresh" : "model");
          setData(result);
          if (result.warning) setError(result.warning);
        } catch (cause) { setError(String(cause.message || cause)); }
        finally { setBusy(false); }
      }
      React.useEffect(() => { void load(true); }, [profile]);
      async function act(action, item, scope) {
        setBusy(true);
        setError("");
        try {
          const migration = item.migration || {};
          await request(action, { packageId: item.id, sourceId: item.sourceId, qualifiedName: item.qualifiedName, scope,
            predecessorId: migration.predecessorId, predecessorSourceId: migration.predecessorSourceId,
            predecessorQualifiedName: migration.predecessorQualifiedName });
          await load(true);
        } catch (cause) { setError(String(cause.message || cause)); setBusy(false); }
      }
      const model = data && data.model;
      const installed = model ? model.installed.filter((item) => (!item.harnessBundle || item.harnessBundle.profile === profile)
        && (!item.harnessProfile || item.harnessProfile === profile)) : [];
      const packages = model ? model.packages.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase())) : [];
      const controls = (item, isInstalled) => {
        if (isInstalled) {
          const actions = [];
          if (item.updateAvailable) actions.push(["update", "Update"]);
          if ((item.moreActions || []).some((option) => option.action === "revert")) actions.push(["revert", "Revert"]);
          actions.push(item.installedPath.startsWith(".offload/") ? ["hotload", "Hotload"] : ["offload", "Offload"]);
          actions.push(["uninstall", "Uninstall"]);
          return actions.map(([action, label]) => h("button", { key: action, type: "button", disabled: busy,
            onClick: () => void act(action, item, item.scope), style: buttonStyle }, label));
        }
        const install = (item.installOptions || []).filter((option) => option.platform === "deepseek-harness" && option.scope !== "cloud")
          .map((option) => h("button", { key: option.scope, type: "button", disabled: busy,
            onClick: () => void act("install", item, option.scope), style: buttonStyle }, `Install ${option.scope}`));
        if (item.migration && item.migration.platform === "deepseek-harness") install.push(h("button", { key: "migrate", type: "button", disabled: busy,
          onClick: () => void act("migrate", item, item.migration.scope), style: buttonStyle }, "Migrate"));
        return install;
      };
      const rows = tab === "installed" ? installed : packages;
      return h("div", { style: { padding: 16, color: "var(--color-fg, inherit)", fontFamily: "inherit", overflowY: "auto", height: "100%" } },
        h("h2", { style: { marginTop: 0 } }, "AI Marketplace"),
        h("label", null, "Harness profile ", h("select", { value: profile, disabled: busy,
          onChange: (event) => { localStorage.setItem("aiMarketplace.profile", event.target.value); setProfile(event.target.value); } },
          [...new Set([profile, ...((data && data.profiles) || ["web"])])].map((name) => h("option", { key: name, value: name }, name)))),
        h("div", { style: { display: "flex", gap: 8, marginTop: 12 } },
          h("button", { type: "button", onClick: () => setTab("available"), "aria-pressed": tab === "available", style: buttonStyle }, "Available"),
          h("button", { type: "button", onClick: () => setTab("installed"), "aria-pressed": tab === "installed", style: buttonStyle }, `Installed (${installed.length})`),
          h("button", { type: "button", disabled: busy, onClick: () => void load(true), style: buttonStyle }, "Refresh")),
        tab === "available" ? h("input", { type: "search", value: search, placeholder: "Search packages", "aria-label": "Search packages", onChange: (event) => setSearch(event.target.value), style: { marginTop: 12, width: "100%" } }) : null,
        error ? h("p", { role: "alert" }, error) : null,
        !model && busy ? h("p", null, "Loading packages...") : null,
        rows.length === 0 && model ? h("p", null, tab === "installed" ? "No packages installed in this profile." : "No packages available.") : null,
        rows.map((item) => h("article", { key: `${item.sourceId}:${item.qualifiedName}:${item.scope || "catalog"}`, style: { borderTop: "1px solid currentColor", padding: "12px 0" } },
          h("strong", null, item.name), h("div", null, `${item.type} · ${item.version} · ${item.sourceLabel || item.sourceId}`),
          h("p", null, item.description),
          h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, controls(item, tab === "installed"))))
      );
    }

    const buttonStyle = { cursor: "pointer", padding: "4px 8px" };
    return {
      inject: ["slots", "sidebarRightTabs"],
      apply(ctx) {
        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: tabId, kind: "ai-marketplace", title: () => "AI Marketplace",
          guide: [{ order: 40, title: () => "AI Marketplace", description: () => "Browse and manage Harness packages" }]
        }), "AI Marketplace tab");
        ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register(
          { name: "sidebar.right.pane.tab", key: tabId }, MarketplacePage
        )), "AI Marketplace page");
      }
    };
  }
});
