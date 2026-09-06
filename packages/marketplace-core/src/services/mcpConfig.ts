import { type MarketplacePackage, type PackageFile, type Platform } from "../types/packages";
import { ValidationError } from "./validation";

export interface McpHostConfig {
  readonly serverName: string;
  readonly serverConfig: Readonly<Record<string, unknown>>;
}

export type ClaudeHookConfig = Readonly<Record<string, readonly unknown[]>>;

export function mcpConfigRelativePath(platform: Platform): string {
  switch (platform) {
    case "codex":
      return ".codex/config.toml";
    case "cursor":
      return ".cursor/mcp.json";
    case "github-copilot":
      return ".copilot/mcp-config.json";
    case "claude":
      return ".claude.json";
  }
}

export function readMcpHostConfig(pkg: MarketplacePackage, platform: Platform, files: readonly PackageFile[]): McpHostConfig {
  const entrypoint = files.find((file) => file.relativePath === pkg.manifest.entrypoint);
  if (!entrypoint) {
    throw new ValidationError(`MCP package '${pkg.manifest.id}' is missing entrypoint '${pkg.manifest.entrypoint}'.`);
  }
  return validateMcpEntrypoint(Buffer.from(entrypoint.content).toString("utf8"), pkg.manifest.id, platform, pkg.manifest.entrypoint);
}

export function validateMcpEntrypoint(content: string, packageId: string, platform: Platform, source: string): McpHostConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new ValidationError(`MCP entrypoint at ${source} must be valid JSON.`);
  }
  if (!isRecord(parsed)) {
    throw new ValidationError(`MCP entrypoint at ${source} must be a JSON object.`);
  }

  const platformConfig = isRecord(parsed[platform]) ? parsed[platform] : parsed;
  const servers = platform === "codex"
    ? platformConfig["mcp_servers"] ?? platformConfig["mcpServers"]
    : platformConfig["mcpServers"];
  if (!isRecord(servers)) {
    if (looksLikeServerConfig(platformConfig)) {
      return { serverName: packageId, serverConfig: normalizeServerConfig(platform, platformConfig) };
    }
    throw new ValidationError(`MCP entrypoint at ${source} must include a supported MCP servers object or a direct MCP server config.`);
  }

  const serverNames = Object.keys(servers);
  if (serverNames.length !== 1) {
    throw new ValidationError(`MCP entrypoint at ${source} must define exactly one MCP server.`);
  }
  const serverConfig = servers[serverNames[0]];
  if (!isRecord(serverConfig)) {
    throw new ValidationError(`MCP entrypoint at ${source} must define its MCP server as a JSON object.`);
  }

  return { serverName: packageId, serverConfig: normalizeServerConfig(platform, serverConfig) };
}

export function upsertJsonMcpServer(
  existingContent: string | undefined,
  serverName: string,
  serverConfig: Readonly<Record<string, unknown>>,
  expectedExisting?: Readonly<Record<string, unknown>>
): string {
  const config = parseExistingJsonObject(existingContent, "MCP configuration");
  const existingServers = isRecord(config["mcpServers"]) ? config["mcpServers"] : {};
  const existing = existingServers[serverName];
  if (existing !== undefined && (!expectedExisting || !sameJsonValue(existing, expectedExisting))) {
    throw new ValidationError(`MCP server '${serverName}' already exists and is not managed by AI Marketplace.`);
  }
  return `${JSON.stringify({
    ...config,
    mcpServers: {
      ...existingServers,
      [serverName]: serverConfig
    }
  }, null, 2)}\n`;
}

export function removeJsonMcpServer(
  existingContent: string | undefined,
  serverName: string,
  expectedServerConfig?: Readonly<Record<string, unknown>>
): string | undefined {
  const config = parseExistingJsonObject(existingContent, "MCP configuration");
  if (!isRecord(config["mcpServers"]) || !(serverName in config["mcpServers"])) {
    return existingContent;
  }
  if (expectedServerConfig && !sameJsonValue(config["mcpServers"][serverName], expectedServerConfig)) {
    throw new ValidationError(`MCP server '${serverName}' was changed outside AI Marketplace and will not be removed.`);
  }
  const remainingServers = { ...config["mcpServers"] };
  delete remainingServers[serverName];
  return `${JSON.stringify({ ...config, mcpServers: remainingServers }, null, 2)}\n`;
}

export function readClaudeHookConfig(content: string, source: string): ClaudeHookConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new ValidationError(`Claude hook entrypoint at ${source} must be valid JSON.`);
  }
  if (!isRecord(parsed) || !isRecord(parsed["hooks"])) {
    throw new ValidationError(`Claude hook entrypoint at ${source} must contain a 'hooks' object.`);
  }
  const hooks: Record<string, readonly unknown[]> = {};
  for (const [event, entries] of Object.entries(parsed["hooks"])) {
    if (!Array.isArray(entries)) {
      throw new ValidationError(`Claude hook entrypoint at ${source} has a non-array '${event}' hook list.`);
    }
    hooks[event] = entries;
  }
  return hooks;
}

export function upsertClaudeHookConfig(existingContent: string | undefined, contribution: ClaudeHookConfig): string {
  const config = parseExistingJsonObject(existingContent, ".claude/settings.json");
  const existingHooks = isRecord(config["hooks"]) ? config["hooks"] : {};
  const hooks: Record<string, unknown> = { ...existingHooks };
  for (const [event, entries] of Object.entries(contribution)) {
    const existing = Array.isArray(hooks[event]) ? hooks[event] : [];
    hooks[event] = [...existing, ...entries.filter((entry) => !existing.some((candidate) => sameJsonValue(candidate, entry)))];
  }
  return `${JSON.stringify({ ...config, hooks }, null, 2)}\n`;
}

export function removeClaudeHookConfig(existingContent: string | undefined, contribution: ClaudeHookConfig): string | undefined {
  const config = parseExistingJsonObject(existingContent, ".claude/settings.json");
  if (!isRecord(config["hooks"])) {
    return existingContent;
  }
  const hooks: Record<string, unknown> = { ...config["hooks"] };
  let changed = false;
  for (const [event, entries] of Object.entries(contribution)) {
    const existing = hooks[event];
    if (!Array.isArray(existing)) {
      continue;
    }
    const remaining = existing.filter((candidate) => !entries.some((entry) => sameJsonValue(candidate, entry)));
    if (remaining.length !== existing.length) {
      changed = true;
      if (remaining.length === 0) delete hooks[event];
      else hooks[event] = remaining;
    }
  }
  return changed ? `${JSON.stringify({ ...config, hooks }, null, 2)}\n` : existingContent;
}

export function upsertCodexMcpServer(existingContent: string | undefined, serverName: string, serverConfig: Readonly<Record<string, unknown>>, expectedExisting?: Readonly<Record<string, unknown>>): string {
  const base = removeCodexMcpServerUnchecked(existingContent, serverName) ?? "";
  if (existingContent !== undefined && base !== existingContent
    && (!expectedExisting || normalizeToml(existingContent) !== normalizeToml(appendCodexServer(base, serverName, expectedExisting)))) {
    throw new ValidationError(`MCP server '${serverName}' already exists or changed outside AI Marketplace.`);
  }
  return appendCodexServer(base, serverName, serverConfig);
}

function appendCodexServer(base: string, serverName: string, serverConfig: Readonly<Record<string, unknown>>): string {
  const separator = base.trim().length > 0 && !base.endsWith("\n\n") ? "\n" : "";
  return `${base}${separator}${codexServerToml(serverName, serverConfig)}`;
}

function normalizeToml(value: string): string { return value.replace(/\r\n/g, "\n").trim(); }

export function removeCodexMcpServer(existingContent: string | undefined, serverName: string, expectedExisting?: Readonly<Record<string, unknown>>): string | undefined {
  const base = removeCodexMcpServerUnchecked(existingContent, serverName);
  if (existingContent !== undefined && base !== existingContent && expectedExisting && normalizeToml(existingContent) !== normalizeToml(appendCodexServer(base ?? "", serverName, expectedExisting))) {
    throw new ValidationError(`MCP server '${serverName}' changed outside AI Marketplace and will not be removed.`);
  }
  return base;
}

function removeCodexMcpServerUnchecked(existingContent: string | undefined, serverName: string): string | undefined {
  if (existingContent === undefined) {
    return undefined;
  }
  const lines = existingContent.split(/\r?\n/);
  const kept: string[] = [];
  let removing = false;
  for (const line of lines) {
    const header = parseTomlTableHeader(line);
    if (header) {
      removing = isManagedCodexMcpHeader(header, serverName);
    }
    if (!removing) {
      kept.push(line);
    }
  }
  const result = kept.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
  return result.trim().length === 0 ? "" : `${result.replace(/\n*$/, "")}\n`;
}

function parseExistingJsonObject(content: string | undefined, source: string): Record<string, unknown> {
  if (!content || content.trim().length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new ValidationError(`${source} must contain valid JSON.`);
  }
  if (!isRecord(parsed)) {
    throw new ValidationError(`${source} must contain a JSON object.`);
  }
  return parsed;
}

function codexServerToml(serverName: string, serverConfig: Readonly<Record<string, unknown>>): string {
  const lines: string[] = [];
  appendTomlTable(lines, ["mcp_servers", serverName], serverConfig);
  return `${lines.join("\n")}\n`;
}

function appendTomlTable(lines: string[], path: readonly string[], record: Readonly<Record<string, unknown>>): void {
  lines.push(`[${path.map(quoteTomlKey).join(".")}]`);
  const nested: [string, Readonly<Record<string, unknown>>][] = [];
  for (const [key, value] of Object.entries(record)) {
    if (isRecord(value)) {
      nested.push([key, value]);
      continue;
    }
    lines.push(`${quoteTomlKey(key)} = ${formatTomlValue(value)}`);
  }
  for (const [key, value] of nested) {
    lines.push("");
    appendTomlTable(lines, [...path, key], value);
  }
}

function formatTomlValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatTomlValue).join(", ")}]`;
  }
  throw new ValidationError("Codex MCP server config contains an unsupported TOML value.");
}

function quoteTomlKey(value: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}

function parseTomlTableHeader(line: string): readonly string[] | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]") || trimmed.startsWith("[[")) {
    return undefined;
  }
  return splitTomlDottedKey(trimmed.slice(1, -1));
}

function splitTomlDottedKey(value: string): readonly string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let escaping = false;
  for (const char of value) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (quoted && char === "\\") {
      escaping = true;
      current += char;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      current += char;
      continue;
    }
    if (!quoted && char === ".") {
      parts.push(parseTomlKeyPart(current.trim()));
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(parseTomlKeyPart(current.trim()));
  return parts;
}

function parseTomlKeyPart(value: string): string {
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return JSON.parse(value) as string;
  }
  return value;
}

function isManagedCodexMcpHeader(header: readonly string[], serverName: string): boolean {
  return header.length >= 2 && header[0] === "mcp_servers" && header[1] === serverName;
}

function normalizeServerConfig(platform: Platform, config: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  if (platform !== "codex") {
    return config;
  }
  const normalized = { ...config };
  if (normalized["type"] === "stdio") {
    delete normalized["type"];
  }
  return normalized;
}

function looksLikeServerConfig(value: Readonly<Record<string, unknown>>): boolean {
  return typeof value["command"] === "string" || typeof value["url"] === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}
