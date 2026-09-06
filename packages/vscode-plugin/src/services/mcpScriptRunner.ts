import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { McpScriptRequest, McpScriptRunner } from "@ai-marketplace/core";

const maximumOutputLength = 64 * 1024;

export class VscodeMcpScriptRunner implements McpScriptRunner {
  public constructor(private readonly log: (message: string) => void) {}

  public async run(request: McpScriptRequest): Promise<void> {
    const packagePath = await safeGlobalPath(request.packagePath);
    const scriptPath = await safeGlobalPath(`${request.packagePath}/${request.script}`);
    if (!(await lstat(scriptPath)).isFile()) throw new Error(`MCP lifecycle script '${request.script}' is not a regular file.`);
    const candidates = process.platform === "win32"
      ? [{ command: "py", prefix: ["-3"] }, { command: "python3", prefix: [] }, { command: "python", prefix: [] }]
      : [{ command: "python3", prefix: [] }, { command: "python", prefix: [] }];
    for (const candidate of candidates) {
      if (!await interpreterAvailable(candidate.command, candidate.prefix)) continue;
      try {
        const output = await runPython(candidate.command, [...candidate.prefix, scriptPath, "--action", request.action, "--platform", request.platform], packagePath, request.timeoutMs);
        if (output) this.log(output);
        return;
      } catch (error) {
        if (isMissingExecutable(error)) continue;
        throw error;
      }
    }
    throw new Error("Python is required for MCP package lifecycle scripts, but no supported interpreter was found.");
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

async function runPython(command: string, args: readonly string[], cwd: string, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
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
      const output = formatOutput(stdout, stderr);
      if (timedOut) { reject(new Error(`MCP lifecycle script timed out after ${Math.round(timeoutMs / 60_000)} minutes.${output ? `\n${output}` : ""}`)); return; }
      if (code === 0) { resolve(output); return; }
      reject(new Error(`MCP lifecycle script failed with exit code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}.${output ? `\n${output}` : ""}`));
    });
  });
}

async function safeGlobalPath(relativePath: string): Promise<string> {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes("\0")) throw new Error(`Unsafe MCP package path '${relativePath}'.`);
  const root = path.resolve(os.homedir());
  const target = path.resolve(root, relativePath);
  const within = path.relative(root, target);
  if (!within || within === ".." || within.startsWith(`..${path.sep}`) || path.isAbsolute(within)) throw new Error(`MCP package path escapes the user directory: '${relativePath}'.`);
  let current = root;
  for (const segment of within.split(path.sep)) {
    current = path.join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in MCP package paths: '${relativePath}'.`);
  }
  return target;
}

function sanitizedEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(?:GH_TOKEN|GITHUB_TOKEN|AZURE_DEVOPS_ACCESS_TOKEN|AZURE_DEVOPS_EXT_PAT|GITLAB_OAUTH_TOKEN|GITLAB_TOKEN|AI_MARKETPLACE_.*(?:TOKEN|PAT|SECRET|PASSWORD))$/i.test(key)) delete env[key];
  return env;
}

function appendBounded(current: string, next: string): string { return `${current}${next}`.slice(-maximumOutputLength); }
function formatOutput(stdout: string, stderr: string): string {
  return redact([stdout.trim() && `stdout:\n${stdout.trim()}`, stderr.trim() && `stderr:\n${stderr.trim()}`].filter(Boolean).join("\n"));
}
function redact(value: string): string {
  return value.replace(/(?:ghp|github_pat|glpat|azdopat)_[A-Za-z0-9_-]+/gi, "[REDACTED]")
    .replace(/(authorization:\s*(?:basic|bearer)\s+)[A-Za-z0-9._~+/=-]+/ig, "$1[REDACTED]");
}
function isMissingExecutable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}
