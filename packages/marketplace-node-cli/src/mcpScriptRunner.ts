import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import type { McpScriptRequest, McpScriptRunner } from "@ai-marketplace/core";
import type { NodeMarketplaceStorage } from "./nodeStorage.js";
import { isRepositoryCredentialEnvironmentKey } from "./credentials.js";

const maximumOutputLength = 64 * 1024;

export class NodeMcpScriptRunner implements McpScriptRunner {
  public constructor(private readonly storage: NodeMarketplaceStorage) {}

  public async run(request: McpScriptRequest): Promise<void> {
    const packagePath = await this.storage.assertSafe("global", request.packagePath, false);
    const scriptPath = await this.storage.assertSafe("global", `${request.packagePath}/${request.script}`, false);
    if (!(await lstat(scriptPath)).isFile()) throw new Error(`MCP lifecycle script '${request.script}' is not a regular file.`);
    const candidates = process.platform === "win32"
      ? [{ command: "py", prefix: ["-3"] }, { command: "python3", prefix: [] }, { command: "python", prefix: [] }]
      : [{ command: "python3", prefix: [] }, { command: "python", prefix: [] }];
    let unavailable: Error | undefined;
    for (const candidate of candidates) {
      if (!await interpreterAvailable(candidate.command, candidate.prefix)) continue;
      try {
        await runPython(candidate.command, [...candidate.prefix, join(packagePath, request.script), "--action", request.action, "--platform", request.platform], packagePath, request.timeoutMs);
        return;
      } catch (error) {
        if (isMissingExecutable(error)) { unavailable = error as Error; continue; }
        throw error;
      }
    }
    throw new Error(`Python is required to ${request.action} this MCP package but no supported interpreter was found. ${unavailable?.message ?? ""}`.trim());
  }
}

async function interpreterAvailable(command: string, prefix: readonly string[]): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, [...prefix, "--version"], { env: sanitizedEnvironment(), shell: false, stdio: "ignore" });
    const timeout = setTimeout(() => { child.kill(); resolve(false); }, 5_000);
    child.once("error", () => { clearTimeout(timeout); resolve(false); });
    child.once("close", (code) => { clearTimeout(timeout); resolve(code === 0); });
  });
}

async function runPython(command: string, args: readonly string[], cwd: string, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: sanitizedEnvironment(), shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (chunk: Buffer) => { stdout = appendBounded(stdout, chunk.toString("utf8")); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = appendBounded(stderr, chunk.toString("utf8")); });
    const timeout = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.once("error", (error) => { clearTimeout(timeout); reject(error); });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (timedOut) { reject(new Error(`MCP lifecycle script timed out after ${Math.round(timeoutMs / 60_000)} minutes.${formatOutput(stdout, stderr)}`)); return; }
      if (code === 0) { resolve(); return; }
      reject(new Error(`MCP lifecycle script failed with exit code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}.${formatOutput(stdout, stderr)}`));
    });
  });
}

function sanitizedEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (isRepositoryCredentialEnvironmentKey(key) || /^AI_MARKETPLACE_.*(?:SECRET|PASSWORD)$/i.test(key)) delete env[key];
  return env;
}

function appendBounded(current: string, next: string): string {
  return `${current}${next}`.slice(-maximumOutputLength);
}

function formatOutput(stdout: string, stderr: string): string {
  const output = redact([stdout.trim() && `stdout:\n${stdout.trim()}`, stderr.trim() && `stderr:\n${stderr.trim()}`].filter(Boolean).join("\n"));
  return output ? `\n${output}` : "";
}

function redact(value: string): string {
  return value.replace(/(?:ghp|github_pat|glpat|azdopat)_[A-Za-z0-9_-]+/gi, "[REDACTED]")
    .replace(/(authorization:\s*(?:basic|bearer)\s+)[A-Za-z0-9._~+/=-]+/ig, "$1[REDACTED]");
}

function isMissingExecutable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
