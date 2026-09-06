import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mcpConfigRelativePath,
  removeCodexMcpServer,
  removeJsonMcpServer,
  upsertCodexMcpServer,
  upsertJsonMcpServer,
  validateMcpEntrypoint
} from "../src/services/mcpConfig";
import { ValidationError } from "../src/services/validation";

describe("MCP config", () => {
  it("reads platform-specific config blocks and normalizes the server name", () => {
    const content = JSON.stringify({
      codex: { mcp_servers: { upstream_name: { type: "stdio", command: "npx", args: ["server"] } } },
      cursor: { mcpServers: { upstream_name: { command: "npx", args: ["server"] } } },
      "github-copilot": { mcpServers: { upstream_name: { command: "npx", args: ["server"] } } },
      claude: { mcpServers: { upstream_name: { command: "npx", args: ["server"] } } }
    });

    assert.deepEqual(validateMcpEntrypoint(content, "my-mcp", "codex", ".mcp.json"), {
      serverName: "my-mcp",
      serverConfig: { command: "npx", args: ["server"] }
    });
    assert.deepEqual(validateMcpEntrypoint(content, "my-mcp", "cursor", ".mcp.json"), {
      serverName: "my-mcp",
      serverConfig: { command: "npx", args: ["server"] }
    });
    assert.deepEqual(validateMcpEntrypoint(content, "my-mcp", "github-copilot", ".mcp.json"), {
      serverName: "my-mcp",
      serverConfig: { command: "npx", args: ["server"] }
    });
    assert.deepEqual(validateMcpEntrypoint(content, "my-mcp", "claude", ".mcp.json"), {
      serverName: "my-mcp",
      serverConfig: { command: "npx", args: ["server"] }
    });
  });

  it("accepts direct server definitions and rejects malformed definitions", () => {
    assert.deepEqual(validateMcpEntrypoint(JSON.stringify({ command: "node", args: ["server.js"] }), "my-mcp", "claude", ".mcp.json"), {
      serverName: "my-mcp",
      serverConfig: { command: "node", args: ["server.js"] }
    });
    assert.throws(() => validateMcpEntrypoint("not json", "my-mcp", "codex", ".mcp.json"), ValidationError);
    assert.throws(() => validateMcpEntrypoint(JSON.stringify({ mcpServers: {} }), "my-mcp", "claude", ".mcp.json"), ValidationError);
    assert.throws(() => validateMcpEntrypoint(JSON.stringify({ mcpServers: { one: {}, two: {} } }), "my-mcp", "claude", ".mcp.json"), ValidationError);
  });

  it("returns the user-level host config paths", () => {
    assert.equal(mcpConfigRelativePath("codex"), ".codex/config.toml");
    assert.equal(mcpConfigRelativePath("cursor"), ".cursor/mcp.json");
    assert.equal(mcpConfigRelativePath("github-copilot"), ".copilot/mcp-config.json");
    assert.equal(mcpConfigRelativePath("claude"), ".claude.json");
  });

  it("upserts and removes JSON MCP servers without changing unrelated settings", () => {
    const existing = JSON.stringify({ otherSetting: true, mcpServers: { existing: { command: "node" } } });
    const updated = upsertJsonMcpServer(existing, "my-mcp", { command: "npx", args: ["server"] });
    assert.deepEqual(JSON.parse(updated), {
      otherSetting: true,
      mcpServers: { existing: { command: "node" }, "my-mcp": { command: "npx", args: ["server"] } }
    });
    assert.deepEqual(JSON.parse(removeJsonMcpServer(updated, "my-mcp", { command: "npx", args: ["server"] }) ?? "{}"), {
      otherSetting: true,
      mcpServers: { existing: { command: "node" } }
    });
    const changed = updated.replace('"server"', '"changed"');
    assert.throws(() => removeJsonMcpServer(changed, "my-mcp", { command: "npx", args: ["server"] }), ValidationError);
  });

  it("removes legacy tracked JSON MCP servers without ownership metadata", () => {
    const existing = JSON.stringify({ mcpServers: { legacy: { command: "legacy-command" } } });
    assert.deepEqual(JSON.parse(removeJsonMcpServer(existing, "legacy") ?? "{}"), {
      mcpServers: {}
    });
  });

  it("upserts and removes Codex MCP tables without changing unrelated TOML", () => {
    const existing = "model = \"gpt-5\"\n\n[mcp_servers.existing]\ncommand = \"node\"\n";
    const updated = upsertCodexMcpServer(existing, "my.mcp", {
      command: "npx",
      args: ["server"],
      env: { API_KEY: "${env:MY_API_KEY}" }
    });
    assert.match(updated, /model = "gpt-5"/);
    assert.match(updated, /\[mcp_servers\.existing\]/);
    assert.match(updated, /\[mcp_servers\."my\.mcp"\]/);
    assert.match(updated, /\[mcp_servers\."my\.mcp"\.env\]/);

    const removed = removeCodexMcpServer(updated, "my.mcp") ?? "";
    assert.match(removed, /\[mcp_servers\.existing\]/);
    assert.doesNotMatch(removed, /my\.mcp/);

    assert.throws(() => upsertCodexMcpServer(existing, "existing", { command: "replacement" }), ValidationError);
    assert.throws(() => upsertCodexMcpServer(existing, "existing", { command: "replacement" }, { command: "changed" }), ValidationError);
    assert.match(upsertCodexMcpServer(existing, "existing", { command: "replacement" }, { command: "node" }), /command = "replacement"/);
  });
});
