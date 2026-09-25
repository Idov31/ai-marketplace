import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import vm from "node:vm";
import { apply as applyHost } from "../dist/index.js";

function traverse(node, match) {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) { const found = traverse(child, match); if (found) return found; }
    return undefined;
  }
  if (match(node)) return node;
  for (const child of node.children || []) {
    const found = traverse(child, match);
    if (found) return found;
  }
  return undefined;
}

describe("Harness Web UI bundle", () => {
  it("registers the native tab and shows installed packages after a catalog failure", async () => {
    let hookIndex = 0;
    const hooks = [];
    let page;
    let client;
    let requestedSessionId;
    const requestedActions = [];
    let catalogFailed = false;
    const React = {
      createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      useState(initial) {
        const index = hookIndex++;
        if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
        return [hooks[index], (value) => { hooks[index] = value; }];
      },
      useEffect(callback) { if (!hooks.effectStarted) { hooks.effectStarted = true; callback(); } }
    };
    const source = await readFile(new URL("../dist/client.js", import.meta.url), "utf8");
    vm.runInNewContext(source, {
      globalThis: { __ModuleLoader__: { load: (entry) => { client = entry; } } },
      localStorage: { getItem: () => "web", setItem: () => undefined },
      fetch: async (_url, options) => { const body = JSON.parse(options.body); requestedSessionId = body.sessionId; requestedActions.push(body);
        if (body.action === "install") catalogFailed = true;
        return { ok: true, json: async () => ({
        model: { installed: [{ id: "offline", qualifiedName: "@team/offline", name: "Offline rule", type: "rule", version: "1.0.0", sourceId: "team", sourceLabel: "Team", scope: "workspace", installedPath: ".dsh/rules/offline", description: "Available offline" }], packages: catalogFailed ? [] : [
          { id: "new-skill", qualifiedName: "@team/new-skill", name: "New skill", type: "skill", version: "1.0.0", sourceId: "team", sourceLabel: "Team", description: "Catalog package", installOptions: [{ platform: "deepseek-harness", scope: "workspace" }] }
        ] },
        profiles: ["web"], warning: catalogFailed ? "Catalog unavailable" : undefined
      }) }; }
    });
    assert.equal(client.id, "ai-marketplace-harness");
    const plugin = client.factory((name) => name === "react" ? React : undefined);
    plugin.apply({
      effect: (register) => register(),
      sidebarRightTabs: { register: (definition) => { assert.equal(definition.kind, "ai-marketplace"); return () => undefined; } },
      slots: { inject: (_name, register) => register(), register: (_definition, component) => { page = component; return () => undefined; } }
    });
    hookIndex = 0;
    page({ sessionId: "session-1" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    hookIndex = 0;
    const initial = page({ sessionId: "session-1" });
    assert.equal(requestedSessionId, "session-1");
    const installButton = traverse(initial, (node) => node.type === "button" && node.children[0] === "Install workspace");
    assert.ok(installButton);
    installButton.props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(requestedActions.some((action) => action.action === "install" && action.packageId === "new-skill"
      && action.scope === "workspace" && action.profile === "web" && action.sessionId === "session-1"));
    const installedButton = traverse(initial, (node) => node.type === "button" && String(node.children[0]).startsWith("Installed"));
    assert.ok(installedButton);
    installedButton.props.onClick();
    hookIndex = 0;
    const installedPage = page({ sessionId: "session-1" });
    assert.ok(traverse(installedPage, (node) => node.type === "strong" && node.children[0] === "Offline rule"));
  });

  it("rejects unauthenticated API requests before reading marketplace state", async () => {
    let handler;
    const host = {
      effect: (register) => register(),
      inject: (_names, callback) => callback(host),
      systemPrompt: { section: () => () => undefined },
      webServer: { register: (route) => { handler = route.handler; return () => undefined; } },
      connection: { requestRejection: () => 401 }
    };
    applyHost(host);
    let status;
    let body;
    await handler({ method: "POST" }, { writeHead: (code) => { status = code; }, end: (value) => { body = JSON.parse(value); } });
    assert.equal(status, 401);
    assert.equal(body.error, "Unauthorized");
  });
});
