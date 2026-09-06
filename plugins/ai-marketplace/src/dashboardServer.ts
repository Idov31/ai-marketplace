import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { packageTypes, type DashboardDetailQuery, type DashboardPlanRequest, type DashboardQuery, type DashboardScope, type DashboardSourceInput, type PackageType } from "@ai-marketplace/core";
import { DashboardApplicationError } from "./dashboardApplication.js";
import type { DashboardApplication, DashboardEvent } from "./dashboardApplication.js";
import type { NodeMarketplaceStorage } from "./nodeStorage.js";

export interface DashboardAsset {
  readonly contentType: string;
  readonly body: string | Uint8Array;
}

export interface DashboardServerOptions {
  readonly workspace: string;
  readonly storage: NodeMarketplaceStorage;
  readonly application: DashboardApplication;
  readonly asset?: (path: string) => Promise<DashboardAsset | undefined>;
  readonly now?: () => Date;
  readonly idleTimeoutMs?: number;
  readonly idleCheckIntervalMs?: number;
}

export interface DashboardDescriptor {
  readonly schemaVersion: 1;
  readonly pid: number;
  readonly port: number;
  readonly origin: string;
  readonly launchUrl: string;
  readonly controlToken: string;
  readonly startedAt: string;
}

export interface DashboardServerHandle {
  readonly origin: string;
  readonly port: number;
  readonly descriptorPath: ".ai_marketplace/dashboard.json";
  issueLaunchUrl(): Promise<string>;
  close(): Promise<void>;
}

export interface DashboardServerStatus {
  readonly schemaVersion: 1;
  readonly pid: number;
  readonly origin: string;
  readonly startedAt: string;
  readonly idleTimeoutMs: number;
}

const descriptorPath = ".ai_marketplace/dashboard.json" as const;
const cookieName = "ai_marketplace_dashboard";
const maximumBodyBytes = 64 * 1024;
const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const defaultIdleTimeoutMs = 30 * 60 * 1000;
const servers = new Map<string, Promise<DashboardServerHandle>>();

interface Session { readonly csrfToken: string; readonly expiresAt: number; }

export function startDashboardServer(options: DashboardServerOptions): Promise<DashboardServerHandle> {
  const key = resolve(options.workspace);
  const existing = servers.get(key);
  if (existing) return existing;
  const started = options.storage.validateRoots().then(() => connectExistingServer(options, key)).then((existingHandle) => existingHandle ?? createDashboardServer(options, key)).catch((error) => { servers.delete(key); throw error; });
  servers.set(key, started);
  return started;
}

async function createDashboardServer(options: DashboardServerOptions, registryKey: string): Promise<DashboardServerHandle> {
  await options.storage.validateRoots();
  const sessions = new Map<string, Session>();
  const eventClients = new Set<ServerResponse>();
  const startedAt = (options.now?.() ?? new Date()).toISOString();
  let origin = "";
  let expectedHost = "";
  let bootstrapToken: string | undefined;
  const controlToken = randomBytes(32).toString("base64url");
  let sequence = 0;
  let closed = false;
  let lastClientActivity = Date.now();

  const publish = (event: DashboardEvent | { readonly event: "heartbeat"; readonly data: { readonly timestamp: string } }): void => {
    sequence += 1;
    const payload = `id: ${sequence}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const response of eventClients) response.write(payload);
  };
  const unsubscribe = options.application.subscribe(publish);
  const server = createServer((request, response) => void route(request, response).catch((error) => sendError(response, error)));

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolveListen(); });
  });
  const address = server.address();
  if (!address || typeof address === "string" || address.address !== "127.0.0.1") {
    server.close();
    throw new Error("Dashboard server failed to bind exclusively to 127.0.0.1.");
  }
  const port = address.port;
  origin = `http://127.0.0.1:${port}`;
  expectedHost = `127.0.0.1:${port}`;

  const writeDescriptor = async (launchUrl: string): Promise<void> => {
    const descriptor: DashboardDescriptor = { schemaVersion: 1, pid: process.pid, port, origin, launchUrl, controlToken, startedAt };
    await options.storage.writeFileAtomic("workspace", descriptorPath, Buffer.from(`${JSON.stringify(descriptor, null, 2)}\n`, "utf8"));
  };
  const issueLaunchUrl = async (): Promise<string> => {
    if (closed) throw new Error("Dashboard server is closed.");
    bootstrapToken = randomBytes(32).toString("base64url");
    const launchUrl = `${origin}/#token=${encodeURIComponent(bootstrapToken)}`;
    await writeDescriptor(launchUrl);
    return launchUrl;
  };

  async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    applySecurityHeaders(response);
    if (request.headers.host !== expectedHost) return sendJson(response, 403, { error: { code: "HOST_REJECTED", message: "Invalid dashboard Host header." } });
    const url = new URL(request.url ?? "/", origin);
    if (url.origin !== origin) return sendJson(response, 403, { error: { code: "ORIGIN_REJECTED", message: "Invalid dashboard request target." } });

    if (request.method === "POST" && url.pathname === "/api/control/launch") {
      if (!secretEqual(controlToken, singleHeader(request.headers["x-dashboard-control"]) ?? "")) return sendJson(response, 403, { error: { code: "CONTROL_REJECTED", message: "Dashboard control token is invalid." } });
      return sendJson(response, 200, { launchUrl: await issueLaunchUrl() });
    }
    if (request.method === "GET" && url.pathname === "/api/control/status") {
      if (!secretEqual(controlToken, singleHeader(request.headers["x-dashboard-control"]) ?? "")) return sendJson(response, 403, { error: { code: "CONTROL_REJECTED", message: "Dashboard control token is invalid." } });
      return sendJson(response, 200, { schemaVersion: 1, pid: process.pid, origin, startedAt, idleTimeoutMs: options.idleTimeoutMs ?? defaultIdleTimeoutMs });
    }
    if (request.method === "POST" && url.pathname === "/api/control/stop") {
      if (!secretEqual(controlToken, singleHeader(request.headers["x-dashboard-control"]) ?? "")) return sendJson(response, 403, { error: { code: "CONTROL_REJECTED", message: "Dashboard control token is invalid." } });
      sendJson(response, 200, { ok: true });
      setImmediate(() => void shutdown());
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/bootstrap") {
      if (request.headers.origin !== origin) return sendJson(response, 403, { error: { code: "ORIGIN_REJECTED", message: "Bootstrap requires the dashboard origin." } });
      const supplied = singleHeader(request.headers["x-dashboard-token"]);
      if (!bootstrapToken || !supplied || !secretEqual(bootstrapToken, supplied)) return sendJson(response, 403, { error: { code: "BOOTSTRAP_REJECTED", message: "Bootstrap token is invalid or already used." } });
      bootstrapToken = undefined;
      const sessionId = randomBytes(32).toString("base64url");
      const csrfToken = randomBytes(32).toString("base64url");
      sessions.set(sessionId, { csrfToken, expiresAt: nowMs() + sessionLifetimeMs });
      response.setHeader("Set-Cookie", `${cookieName}=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(sessionLifetimeMs / 1000)}`);
      await writeDescriptor(origin);
      return sendJson(response, 200, { csrfToken });
    }

    if (url.pathname.startsWith("/api/")) {
      const session = authenticate(request, sessions);
      if (!session) return sendJson(response, 401, { error: { code: "AUTH_REQUIRED", message: "Dashboard session is missing or expired." } });
      const originHeader = request.headers.origin;
      if (originHeader !== undefined && originHeader !== origin) return sendJson(response, 403, { error: { code: "ORIGIN_REJECTED", message: "Invalid dashboard Origin header." } });
      if (request.method === "POST") {
        if (originHeader !== origin) return sendJson(response, 403, { error: { code: "ORIGIN_REJECTED", message: "Mutation requires the dashboard origin." } });
        if (!secretEqual(session.csrfToken, singleHeader(request.headers["x-csrf-token"]) ?? "")) return sendJson(response, 403, { error: { code: "CSRF_REJECTED", message: "CSRF token is invalid." } });
      }
      lastClientActivity = Date.now();

      if (request.method === "GET" && url.pathname === "/api/model") return sendJson(response, 200, await options.application.getModel(parseDashboardQuery(url.searchParams)));
      if (request.method === "GET" && url.pathname.startsWith("/api/packages/")) {
        const identityPath = url.pathname.slice("/api/packages/".length);
        const separator = identityPath.indexOf("/");
        if (separator <= 0 || separator === identityPath.length - 1) throw validation("Package route requires sourceId and qualifiedName.");
        const identity = `${decodeURIComponent(identityPath.slice(0, separator))}:${decodeURIComponent(identityPath.slice(separator + 1))}`;
        return sendJson(response, 200, await options.application.getDetail(identity, parseDashboardDetailQuery(url.searchParams)));
      }
      if (request.method === "GET" && url.pathname === "/api/events") {
        response.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" });
        response.write(`id: ${sequence}\nevent: ready\ndata: ${JSON.stringify({ sequence })}\n\n`);
        eventClients.add(response);
        request.on("close", () => eventClients.delete(response));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/plans") return sendJson(response, 200, await options.application.createPlan(parsePlanRequest(await readJsonBody(request))));
      if (request.method === "POST" && /^\/api\/plans\/[^/]+\/apply$/.test(url.pathname)) {
        const body = await readJsonBody(request);
        if (!isRecord(body) || Object.keys(body).length !== 0) throw validation("Apply body must be an empty JSON object.");
        const planId = decodeURIComponent(url.pathname.slice("/api/plans/".length, -"/apply".length));
        return sendJson(response, 200, await options.application.applyPlan(planId));
      }
      if (request.method === "POST" && url.pathname === "/api/refresh") return sendJson(response, 200, await options.application.refresh());
      if (request.method === "POST" && url.pathname === "/api/diagnose") return sendJson(response, 200, await options.application.diagnose());
      if (request.method === "POST" && url.pathname === "/api/heartbeat") {
        const body = await readJsonBody(request);
        if (!isRecord(body) || Object.keys(body).length !== 0) throw validation("Heartbeat body must be an empty JSON object.");
        return sendJson(response, 200, { ok: true, idleTimeoutMs: options.idleTimeoutMs ?? defaultIdleTimeoutMs });
      }
      return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Dashboard API route was not found." } });
    }

    if (request.method !== "GET") return sendJson(response, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Method is not allowed." } });
    const assetPath = url.pathname === "/" ? "/index.html" : url.pathname;
    if (!/^\/[A-Za-z0-9._/-]+$/.test(assetPath) || assetPath.includes("..")) return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Asset was not found." } });
    const asset = await options.asset?.(assetPath);
    if (!asset) return sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Asset was not found." } });
    response.statusCode = 200;
    response.setHeader("Content-Type", asset.contentType);
    response.end(asset.body);
  }

  const heartbeat = setInterval(() => publish({ event: "heartbeat", data: { timestamp: new Date(nowMs()).toISOString() } }), 25_000);
  heartbeat.unref();
  const idleTimeoutMs = options.idleTimeoutMs ?? defaultIdleTimeoutMs;
  const idleCheck = setInterval(() => { if (Date.now() - lastClientActivity >= idleTimeoutMs) void shutdown(); }, options.idleCheckIntervalMs ?? Math.min(60_000, Math.max(250, Math.floor(idleTimeoutMs / 4))));
  idleCheck.unref();
  const launchUrl = await issueLaunchUrl();
  const shutdown = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearInterval(idleCheck);
    unsubscribe();
    eventClients.forEach((response) => response.end());
    eventClients.clear();
    sessions.clear();
    await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
    await options.storage.remove("workspace", descriptorPath);
    servers.delete(registryKey);
  };
  const handle: DashboardServerHandle = {
    origin,
    port,
    descriptorPath,
    issueLaunchUrl,
    close: shutdown
  };
  await writeDescriptor(launchUrl);
  return handle;

  function nowMs(): number { return options.now?.().getTime() ?? Date.now(); }
}

async function connectExistingServer(options: DashboardServerOptions, registryKey: string): Promise<DashboardServerHandle | undefined> {
  const descriptor = await readDashboardDescriptor(options.storage);
  if (!descriptor) return undefined;
  const control = async (path: "launch" | "stop"): Promise<Response | undefined> => {
    try { return await fetch(`${descriptor.origin}/api/control/${path}`, { method: "POST", headers: { Host: `127.0.0.1:${descriptor.port}`, "X-Dashboard-Control": descriptor.controlToken }, signal: AbortSignal.timeout(1000) }); }
    catch { return undefined; }
  };
  const launched = await control("launch");
  if (!launched?.ok) { await options.storage.remove("workspace", descriptorPath); return undefined; }
  const payload = await launched.json() as { launchUrl?: unknown };
  if (typeof payload.launchUrl !== "string" || !payload.launchUrl.startsWith(`${descriptor.origin}/#token=`)) return undefined;
  return {
    origin: descriptor.origin,
    port: descriptor.port,
    descriptorPath,
    issueLaunchUrl: async () => {
      const response = await control("launch");
      if (!response?.ok) throw new Error("Existing dashboard server did not issue a launch URL.");
      const value = await response.json() as { launchUrl?: unknown };
      if (typeof value.launchUrl !== "string") throw new Error("Existing dashboard launch response is invalid.");
      return value.launchUrl;
    },
    close: async () => { await control("stop"); servers.delete(registryKey); }
  };
}

export async function readDashboardDescriptor(storage: NodeMarketplaceStorage): Promise<DashboardDescriptor | undefined> {
  const bytes = await storage.readFile("workspace", descriptorPath);
  if (!bytes) return undefined;
  let descriptor: DashboardDescriptor;
  try { descriptor = JSON.parse(Buffer.from(bytes).toString("utf8")) as DashboardDescriptor; }
  catch { await storage.remove("workspace", descriptorPath); return undefined; }
  if (descriptor.schemaVersion !== 1
    || !Number.isSafeInteger(descriptor.pid) || descriptor.pid <= 0
    || !Number.isSafeInteger(descriptor.port) || descriptor.port <= 0 || descriptor.port > 65_535
    || descriptor.origin !== `http://127.0.0.1:${descriptor.port}`
    || !validDescriptorLaunchUrl(descriptor.origin, descriptor.launchUrl)
    || typeof descriptor.controlToken !== "string" || descriptor.controlToken.length < 32
    || typeof descriptor.startedAt !== "string" || !Number.isFinite(Date.parse(descriptor.startedAt))) {
    await storage.remove("workspace", descriptorPath);
    return undefined;
  }
  return descriptor;
}

export async function getDashboardServerStatus(storage: NodeMarketplaceStorage): Promise<DashboardServerStatus | undefined> {
  await storage.validateRoots();
  const descriptor = await readDashboardDescriptor(storage);
  if (!descriptor) return undefined;
  try {
    const response = await fetch(`${descriptor.origin}/api/control/status`, { headers: { Host: `127.0.0.1:${descriptor.port}`, "X-Dashboard-Control": descriptor.controlToken }, signal: AbortSignal.timeout(1000) });
    if (!response.ok) { await storage.remove("workspace", descriptorPath); return undefined; }
    const value = await response.json() as DashboardServerStatus;
    return value.schemaVersion === 1 && value.origin === descriptor.origin && value.pid === descriptor.pid ? value : undefined;
  } catch { await storage.remove("workspace", descriptorPath); return undefined; }
}

function applySecurityHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function authenticate(request: IncomingMessage, sessions: Map<string, Session>): Session | undefined {
  const cookies = Object.fromEntries((request.headers.cookie ?? "").split(";").map((part) => part.trim().split("=", 2)).filter((pair) => pair.length === 2));
  const id = cookies[cookieName];
  if (!id) return undefined;
  const session = sessions.get(id);
  if (!session || session.expiresAt <= Date.now()) { sessions.delete(id); return undefined; }
  return session;
}

function parseDashboardQuery(search: URLSearchParams): DashboardQuery {
  const allowed = new Set(["tab", "search", "type", "group", "sourceId", "scope", "page", "pageSize"]);
  for (const key of search.keys()) if (!allowed.has(key)) throw validation(`Unknown dashboard filter '${key}'.`);
  const tab = optionalEnum(search.get("tab"), ["available", "installed", "updates"] as const, "tab");
  const type = optionalEnum(search.get("type"), packageTypes, "type");
  const scope = optionalEnum(search.get("scope"), ["workspace", "global"] as const, "scope");
  return {
    ...(tab ? { tab } : {}),
    ...(type ? { type } : {}),
    ...(scope ? { scope } : {}),
    ...optionalText(search, "search"),
    ...optionalText(search, "group"),
    ...optionalText(search, "sourceId"),
    ...optionalInteger(search, "page"),
    ...optionalInteger(search, "pageSize")
  };
}

function parseDashboardDetailQuery(search: URLSearchParams): DashboardDetailQuery {
  const allowed = new Set(["kind", "scope"]);
  for (const key of search.keys()) if (!allowed.has(key)) throw validation(`Unknown package detail query field '${key}'.`);
  const kinds = search.getAll("kind");
  const scopes = search.getAll("scope");
  if (kinds.length !== 1 || (kinds[0] !== "available" && kinds[0] !== "installed")) throw validation("Package detail requires exactly one kind: available or installed.");
  if (kinds[0] === "available") {
    if (scopes.length !== 0) throw validation("Available package detail must not include scope.");
    return { kind: "available" };
  }
  if (scopes.length !== 1 || (scopes[0] !== "workspace" && scopes[0] !== "global")) throw validation("Installed package detail requires exactly one workspace or global scope.");
  return { kind: "installed", scope: scopes[0] };
}

function parsePlanRequest(value: unknown): DashboardPlanRequest {
  if (!isRecord(value) || typeof value.action !== "string") throw validation("Plan request requires an action.");
  switch (value.action) {
    case "install": case "update": case "migrate": case "revert": case "uninstall": case "hotload": case "offload": {
      assertKeys(value, ["action", "identities", "scope"]);
      if (!Array.isArray(value.identities) || !value.identities.every((identity) => typeof identity === "string")) throw validation("Lifecycle plan identities must be strings.");
      const scope = optionalScope(value.scope);
      return { action: value.action, identities: value.identities, ...(scope ? { scope } : {}) };
    }
    case "install-group":
      assertKeys(value, ["action", "group", "scope"]);
      if (typeof value.group !== "string" || !value.group.trim()) throw validation("Group is required.");
      return { action: "install-group", group: value.group, scope: requiredScope(value.scope) };
    case "sync": {
      assertKeys(value, ["action", "scope"]);
      const scope = optionalScope(value.scope);
      return { action: "sync", ...(scope ? { scope } : {}) };
    }
    case "set-preferences":
      assertKeys(value, ["action", "autoUpdate", "autoInstallGroups"]);
      if (typeof value.autoUpdate !== "boolean" || !Array.isArray(value.autoInstallGroups) || !value.autoInstallGroups.every((group) => typeof group === "string")) throw validation("Preferences require autoUpdate and string autoInstallGroups.");
      return { action: "set-preferences", autoUpdate: value.autoUpdate, autoInstallGroups: value.autoInstallGroups };
    case "source-add": case "source-update":
      assertKeys(value, ["action", "source"]);
      return { action: value.action, source: parseDashboardSource(value.source) };
    case "source-remove":
      assertKeys(value, ["action", "sourceId"]);
      if (typeof value.sourceId !== "string" || !value.sourceId) throw validation("Source id is required.");
      return { action: "source-remove", sourceId: value.sourceId };
    default: throw validation(`Unsupported dashboard plan action '${value.action}'.`);
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw validation("Request Content-Type must be application/json.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maximumBodyBytes) throw validation("Request body exceeds 64 KiB.");
    chunks.push(bytes);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw validation("Request body must be valid JSON."); }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  if (response.writableEnded) return;
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(value)}\n`);
}

function sendError(response: ServerResponse, error: unknown): void {
  const status = error instanceof DashboardApplicationError
    ? error.code === "NOT_FOUND" ? 404 : error.code === "STALE_PLAN" || error.code === "EXPIRED_PLAN" ? 409 : 422
    : error instanceof DashboardRequestError ? 400 : 500;
  const code = error instanceof DashboardApplicationError || error instanceof DashboardRequestError ? error.code : "INTERNAL";
  const message = code === "INTERNAL" ? "The dashboard request failed unexpectedly." : redactSensitive(safeMessage(error));
  sendJson(response, status, { error: { code, message } });
}

class DashboardRequestError extends Error { public readonly code = "VALIDATION"; }
function validation(message: string): DashboardRequestError { return new DashboardRequestError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function assertKeys(value: Record<string, unknown>, allowed: readonly string[]): void { const unknown = Object.keys(value).find((key) => !allowed.includes(key)); if (unknown) throw validation(`Unknown plan field '${unknown}'.`); }
function parseDashboardSource(value: unknown): DashboardSourceInput {
  if (!isRecord(value)) throw validation("Source plan requires a source object.");
  assertKeys(value, ["id", "url", "label", "branch", "enabled", "allowDefaultPackages", "packageFolders"]);
  if (typeof value.id !== "string" || typeof value.url !== "string" || !value.id || !value.url) throw validation("Source plan requires non-empty id and url strings.");
  if (value.label !== undefined && typeof value.label !== "string") throw validation("Source label must be a string.");
  if (value.branch !== undefined && typeof value.branch !== "string") throw validation("Source branch must be a string.");
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") throw validation("Source enabled must be boolean.");
  if (value.allowDefaultPackages !== undefined && typeof value.allowDefaultPackages !== "boolean") throw validation("Source allowDefaultPackages must be boolean.");
  let packageFolders: Partial<Record<PackageType, string>> | undefined;
  if (value.packageFolders !== undefined) {
    if (!isRecord(value.packageFolders)) throw validation("Source packageFolders must be an object.");
    assertKeys(value.packageFolders, packageTypes);
    packageFolders = {};
    for (const type of packageTypes) {
      const folder = value.packageFolders[type];
      if (folder !== undefined) {
        if (typeof folder !== "string") throw validation(`Source packageFolders.${type} must be a string.`);
        packageFolders[type] = folder;
      }
    }
  }
  return {
    id: value.id,
    url: value.url,
    ...(value.label === undefined ? {} : { label: value.label }),
    ...(value.branch === undefined ? {} : { branch: value.branch }),
    ...(value.enabled === undefined ? {} : { enabled: value.enabled }),
    ...(value.allowDefaultPackages === undefined ? {} : { allowDefaultPackages: value.allowDefaultPackages }),
    ...(packageFolders === undefined ? {} : { packageFolders })
  };
}
function requiredScope(value: unknown): DashboardScope { const scope = optionalScope(value); if (!scope) throw validation("Scope must be workspace or global."); return scope; }
function optionalScope(value: unknown): DashboardScope | undefined { if (value === undefined) return undefined; if (value === "workspace" || value === "global") return value; throw validation("Scope must be workspace or global."); }
function optionalEnum<T extends string>(value: string | null, values: readonly T[], label: string): T | undefined { if (value === null || value === "") return undefined; if (values.includes(value as T)) return value as T; throw validation(`Invalid ${label}.`); }
function optionalText(search: URLSearchParams, key: string): Record<string, string> { const value = search.get(key); return value === null || value === "" ? {} : { [key]: value.slice(0, 256) }; }
function optionalInteger(search: URLSearchParams, key: string): Record<string, number> { const value = search.get(key); if (value === null || value === "") return {}; const parsed = Number(value); if (!Number.isSafeInteger(parsed) || parsed <= 0) throw validation(`${key} must be a positive integer.`); return { [key]: parsed }; }
function singleHeader(value: string | readonly string[] | undefined): string | undefined { return typeof value === "string" ? value : undefined; }
function secretEqual(expected: string, actual: string): boolean { const left = Buffer.from(expected); const right = Buffer.from(actual); return left.length === right.length && timingSafeEqual(left, right); }
function validDescriptorLaunchUrl(origin: string, value: unknown): value is string {
  if (value === origin) return true;
  if (typeof value !== "string" || !value.startsWith(`${origin}/#token=`)) return false;
  try {
    const parsed = new URL(value);
    const token = new URLSearchParams(parsed.hash.slice(1)).get("token");
    return parsed.origin === origin && parsed.pathname === "/" && parsed.search === "" && typeof token === "string" && token.length >= 32;
  } catch { return false; }
}
function redactSensitive(value: string): string { return value.replace(/(?:ghp|github_pat|glpat|azdopat)_[A-Za-z0-9_-]+/gi, "[REDACTED]"); }
function safeMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
