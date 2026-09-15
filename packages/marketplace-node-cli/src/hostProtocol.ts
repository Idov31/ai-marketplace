import { Buffer } from "node:buffer";
import type { Readable, Writable } from "node:stream";
import type { CredentialProvider, RepositoryConfig, RepositoryCredential, RepositoryCredentialKind, RepositoryProvider } from "@ai-marketplace/core";

export const hostProtocolVersion = 1 as const;
export const maximumHostFrameBytes = 64 * 1024;
const maximumOutstandingCallbacks = 32;
const defaultCallbackTimeoutMs = 30_000;
const maximumIgnoredResponseIds = 64;

export interface HostInitializeRequest {
  readonly protocolVersion: 1;
  readonly runtimeVersion: string;
  readonly host: "visualstudio" | "jetbrains" | "test";
  readonly hostVersion: string;
  readonly extensionVersion: string;
  readonly workspaceRoot?: string;
  readonly userRoot: string;
  readonly platform: "codex" | "cursor" | "github-copilot" | "claude";
  readonly capabilities: readonly ("credentials" | "configuration" | "notifications" | "external-links")[];
}

export interface HostProtocolError {
  readonly code: string;
  readonly message: string;
}

type ProtocolId = string;
type HostProtocolMessage =
  | { readonly protocolVersion: 1; readonly type: "request"; readonly id: ProtocolId; readonly method: string; readonly params: unknown }
  | { readonly protocolVersion: 1; readonly type: "response"; readonly id: ProtocolId; readonly result?: unknown; readonly error?: HostProtocolError }
  | { readonly protocolVersion: 1; readonly type: "notification"; readonly method: string; readonly params: unknown };

export type HostRequestHandler = (method: string, params: unknown, signal: AbortSignal) => Promise<unknown>;

interface PendingCallback {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

export class HostProtocolConnection {
  private buffer = Buffer.alloc(0);
  private expectedBodyBytes: number | undefined;
  private nextId = 1;
  private readonly pendingCallbacks = new Map<ProtocolId, PendingCallback>();
  private readonly activeRequests = new Map<ProtocolId, AbortController>();
  private readonly ignoredResponseIds = new Set<ProtocolId>();
  private initialized = false;
  private initializing = false;
  private closed = false;

  public constructor(
    private readonly input: Readable,
    private readonly output: Writable,
    private readonly requestHandler: HostRequestHandler,
    private readonly diagnostics: (message: string) => void = () => undefined,
    private readonly sanitize: (message: string) => string = (message) => message
  ) {}

  public start(): void {
    this.input.on("data", (chunk: Buffer | string) => this.accept(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    this.input.on("end", () => this.close(new Error("Host protocol input closed.")));
    this.input.on("error", (error) => this.close(error));
  }

  public async callback(method: string, params: unknown, options: { readonly signal?: AbortSignal; readonly timeoutMs?: number } = {}): Promise<unknown> {
    if (!this.initialized && !this.initializing) throw new Error("Host protocol is not initialized.");
    if (this.closed) throw new Error("Host protocol is closed.");
    if (!/^[a-z][a-z0-9.-]+$/.test(method)) throw new Error("Host callback method is invalid.");
    if (this.pendingCallbacks.size >= maximumOutstandingCallbacks) throw new Error("Host callback limit exceeded.");
    const id = `runtime-${this.nextId++}`;
    const timeoutMs = options.timeoutMs ?? defaultCallbackTimeoutMs;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCallbacks.delete(id);
        this.ignoreLateResponse(id);
        reject(new Error(`Host callback '${method}' timed out.`));
      }, timeoutMs);
      timer.unref();
      const onAbort = (): void => {
        clearTimeout(timer);
        this.pendingCallbacks.delete(id);
        this.ignoreLateResponse(id);
        reject(new Error(`Host callback '${method}' was cancelled.`));
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      this.pendingCallbacks.set(id, {
        timer,
        resolve: (value) => { options.signal?.removeEventListener("abort", onAbort); resolve(value); },
        reject: (error) => { options.signal?.removeEventListener("abort", onAbort); reject(error); }
      });
      this.write({ protocolVersion: hostProtocolVersion, type: "request", id, method, params });
    });
  }

  public notify(method: string, params: unknown): void {
    if (!this.initialized || this.closed) return;
    this.write({ protocolVersion: hostProtocolVersion, type: "notification", method, params });
  }

  public close(reason = new Error("Host protocol closed.")): void {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pendingCallbacks.values()) { clearTimeout(pending.timer); pending.reject(reason); }
    this.pendingCallbacks.clear();
    for (const controller of this.activeRequests.values()) controller.abort();
    this.activeRequests.clear();
  }

  private accept(chunk: Buffer): void {
    if (this.closed) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    try {
      while (true) {
        if (this.expectedBodyBytes === undefined) {
          const boundary = this.buffer.indexOf("\r\n\r\n");
          if (boundary < 0) {
            if (this.buffer.length > 256) throw new Error("Host protocol header is too large.");
            return;
          }
          const header = this.buffer.subarray(0, boundary).toString("ascii");
          const match = /^Content-Length: ([0-9]+)$/i.exec(header);
          if (!match) throw new Error("Host protocol frame header is invalid.");
          const length = Number(match[1]);
          if (!Number.isSafeInteger(length) || length <= 0 || length > maximumHostFrameBytes) throw new Error("Host protocol frame length is invalid.");
          this.expectedBodyBytes = length;
          this.buffer = this.buffer.subarray(boundary + 4);
        }
        if (this.buffer.length < this.expectedBodyBytes) return;
        const body = this.buffer.subarray(0, this.expectedBodyBytes);
        this.buffer = this.buffer.subarray(this.expectedBodyBytes);
        this.expectedBodyBytes = undefined;
        const parsed = JSON.parse(body.toString("utf8")) as unknown;
        void this.dispatch(validateMessage(parsed)).catch((error) => this.failClosed(error));
      }
    } catch (error) {
      this.failClosed(error);
    }
  }

  private async dispatch(message: HostProtocolMessage): Promise<void> {
    if (message.type === "response") {
      const pending = this.pendingCallbacks.get(message.id);
      if (!pending) {
        if (this.ignoredResponseIds.delete(message.id)) return;
        throw new Error("Host protocol response id is unknown or duplicated.");
      }
      this.pendingCallbacks.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`)); else pending.resolve(message.result);
      return;
    }
    if (message.type === "notification") {
      if (message.method !== "cancel") throw new Error("Host protocol notification method is not allowed.");
      const id = isRecord(message.params) && typeof message.params.id === "string" ? message.params.id : undefined;
      if (!id) throw new Error("Host protocol cancellation id is invalid.");
      this.activeRequests.get(id)?.abort();
      return;
    }
    if (this.activeRequests.has(message.id)) throw new Error("Host protocol request id is duplicated.");
    if (!this.initialized && message.method !== "initialize") throw new Error("Host protocol requires initialize as the first request.");
    if (this.initialized && message.method === "initialize") throw new Error("Host protocol cannot be initialized twice.");
    const controller = new AbortController();
    this.activeRequests.set(message.id, controller);
    if (message.method === "initialize") this.initializing = true;
    try {
      const result = await this.requestHandler(message.method, message.params, controller.signal);
      if (controller.signal.aborted) return;
      if (message.method === "initialize") this.initialized = true;
      this.write({ protocolVersion: hostProtocolVersion, type: "response", id: message.id, result: this.sanitizeValue(result) });
    } catch (error) {
      if (controller.signal.aborted) return;
      this.write({ protocolVersion: hostProtocolVersion, type: "response", id: message.id, error: { code: "REQUEST_FAILED", message: this.sanitize(safeError(error)) } });
    } finally {
      if (message.method === "initialize") this.initializing = false;
      this.activeRequests.delete(message.id);
    }
  }

  private write(message: HostProtocolMessage): void {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    if (body.length > maximumHostFrameBytes) throw new Error("Host protocol output frame is too large.");
    this.output.write(`Content-Length: ${body.length}\r\n\r\n`);
    this.output.write(body);
  }

  private failClosed(error: unknown): void {
    this.diagnostics(this.sanitize(`Host protocol closed: ${safeError(error)}`));
    this.close(error instanceof Error ? error : new Error(String(error)));
    this.input.destroy();
  }

  private ignoreLateResponse(id: ProtocolId): void {
    if (this.ignoredResponseIds.size >= maximumIgnoredResponseIds) this.ignoredResponseIds.delete(this.ignoredResponseIds.values().next().value as string);
    this.ignoredResponseIds.add(id);
  }

  private sanitizeValue(value: unknown): unknown {
    if (typeof value === "string") return this.sanitize(value);
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item));
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.sanitizeValue(item)]));
    return value;
  }
}

export class SecretRedactor {
  private readonly secrets = new Set<string>();

  public register(secret: string): void {
    if (secret.length >= 4) this.secrets.add(secret);
  }

  public redact(value: string): string {
    let redacted = value;
    for (const secret of this.secrets) redacted = redacted.split(secret).join("[REDACTED]");
    return redacted
      .replace(/(?:ghp|github_pat|glpat|azdopat)_[A-Za-z0-9_-]+/gi, "[REDACTED]")
      .replace(/(authorization:\s*)\S+/ig, "$1[REDACTED]")
      .replace(/(private-token:\s*)\S+/ig, "$1[REDACTED]");
  }
}

export function createHostCredentialProvider(connection: HostProtocolConnection, redactor: SecretRedactor): CredentialProvider {
  const request = async (provider: RepositoryProvider, sourceId?: string): Promise<readonly RepositoryCredential[]> => {
    const value = await connection.callback("credentials.get", { provider, ...(sourceId ? { sourceId } : {}) });
    if (!Array.isArray(value) || value.length > 4) throw new Error("Host credential response is invalid.");
    return value.map((item) => validateCredential(item, redactor));
  };
  return {
    sharedCredentials: (provider) => request(provider),
    sourceCredentials: (source: RepositoryConfig) => request(source.provider, source.id)
  };
}

export function validateInitializeRequest(value: unknown): HostInitializeRequest {
  if (!isRecord(value)
    || value.protocolVersion !== hostProtocolVersion
    || typeof value.runtimeVersion !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(value.runtimeVersion)
    || !["visualstudio", "jetbrains", "test"].includes(String(value.host))
    || typeof value.hostVersion !== "string" || value.hostVersion.length < 1 || value.hostVersion.length > 64
    || typeof value.extensionVersion !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(value.extensionVersion)
    || (value.workspaceRoot !== undefined && typeof value.workspaceRoot !== "string")
    || typeof value.userRoot !== "string"
    || !["codex", "cursor", "github-copilot", "claude"].includes(String(value.platform))
    || !Array.isArray(value.capabilities)
    || !value.capabilities.every((item) => ["credentials", "configuration", "notifications", "external-links"].includes(String(item)))) {
    throw new Error("Host initialize request is invalid or incompatible.");
  }
  return value as unknown as HostInitializeRequest;
}

function validateCredential(value: unknown, redactor: SecretRedactor): RepositoryCredential {
  if (!isRecord(value) || !["bearer", "basic-pat", "private-token"].includes(String(value.kind)) || typeof value.token !== "string" || value.token.length < 4 || value.token.length > 16_384) {
    throw new Error("Host credential value is invalid.");
  }
  redactor.register(value.token);
  return { kind: value.kind as RepositoryCredentialKind, token: value.token, source: "visual-studio-secure-store" };
}

function validateMessage(value: unknown): HostProtocolMessage {
  if (!isRecord(value) || value.protocolVersion !== hostProtocolVersion || !["request", "response", "notification"].includes(String(value.type))) throw new Error("Host protocol message envelope is invalid.");
  if (value.type === "request" && (typeof value.id !== "string" || typeof value.method !== "string" || !("params" in value))) throw new Error("Host protocol request is invalid.");
  if (value.type === "response" && (typeof value.id !== "string" || (("result" in value) === ("error" in value)))) throw new Error("Host protocol response is invalid.");
  if (value.type === "notification" && (typeof value.method !== "string" || !("params" in value))) throw new Error("Host protocol notification is invalid.");
  return value as HostProtocolMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function safeError(error: unknown): string { return error instanceof Error ? error.message : String(error); }
