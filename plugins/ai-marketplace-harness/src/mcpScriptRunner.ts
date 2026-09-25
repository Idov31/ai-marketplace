import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { McpScriptRequest, McpScriptRunner } from "../../../packages/marketplace-core/src/index.ts";

const outputLimit = 64 * 1024;

export class HarnessMcpScriptRunner implements McpScriptRunner {
  public async run(request: McpScriptRequest): Promise<void> {
    const root = resolve(homedir());
    const packagePath = await safePath(root, request.packagePath, "directory");
    const scriptPath = await safePath(root, `${request.packagePath}/${request.script}`, "file");
    const candidates = process.platform === "win32"
      ? [{ command: "py", prefix: ["-3"] }, { command: "python3", prefix: [] }, { command: "python", prefix: [] }]
      : [{ command: "python3", prefix: [] }, { command: "python", prefix: [] }];
    for (const candidate of candidates) {
      if (!await available(candidate.command, candidate.prefix)) continue;
      const output = await execute(candidate.command, [...candidate.prefix, scriptPath, "--action", request.action,
        "--platform", request.platform], packagePath, request.timeoutMs);
      if (output) process.stderr.write(`${redact(output)}\n`);
      return;
    }
    throw new Error("Python is required for MCP package lifecycle scripts, but no supported interpreter was found.");
  }
}

async function safePath(root: string, relativePath: string, kind: "file" | "directory"): Promise<string> {
  if (!relativePath || isAbsolute(relativePath) || relativePath.includes("\0")) throw new Error("Unsafe MCP lifecycle package path.");
  const target = resolve(root, relativePath);
  const child = relative(root, target);
  if (!child || child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error("MCP lifecycle package path escapes the user directory.");
  let current = root;
  const segments = child.split(sep);
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error("MCP lifecycle package paths cannot contain symbolic links.");
    if (index < segments.length - 1 && !info.isDirectory()) throw new Error("MCP lifecycle package path contains a non-directory component.");
    if (index === segments.length - 1 && (kind === "file" ? !info.isFile() : !info.isDirectory())) {
      throw new Error(kind === "file" ? "MCP lifecycle script is not a regular file." : "MCP package payload is not a directory.");
    }
  }
  return target;
}

async function available(command: string, prefix: readonly string[]): Promise<boolean> {
  return new Promise((resolveAvailable) => {
    const child = spawn(command, [...prefix, "--version"], { env: sanitizedEnvironment(), shell: false, windowsHide: true, stdio: "ignore" });
    const timeout = setTimeout(() => { child.kill(); resolveAvailable(false); }, 5_000);
    child.once("error", () => { clearTimeout(timeout); resolveAvailable(false); });
    child.once("close", (code) => { clearTimeout(timeout); resolveAvailable(code === 0); });
  });
}

async function execute(command: string, args: readonly string[], cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, env: sanitizedEnvironment(), shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let timedOut = false;
    child.stdout?.on("data", (chunk: Buffer) => { output = `${output}${chunk.toString("utf8")}`.slice(-outputLimit); });
    child.stderr?.on("data", (chunk: Buffer) => { output = `${output}${chunk.toString("utf8")}`.slice(-outputLimit); });
    const timeout = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.once("error", (error) => { clearTimeout(timeout); rejectRun(error); });
    child.once("close", (code) => {
      clearTimeout(timeout);
      const safeOutput = redact(output.trim());
      if (timedOut) rejectRun(new Error(`MCP lifecycle script timed out after ${Math.round(timeoutMs / 60_000)} minutes.${safeOutput ? `\n${safeOutput}` : ""}`));
      else if (code === 0) resolveRun(safeOutput);
      else rejectRun(new Error(`MCP lifecycle script failed with exit code ${code ?? "unknown"}.${safeOutput ? `\n${safeOutput}` : ""}`));
    });
  });
}

function sanitizedEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(?:GH_TOKEN|GITHUB_TOKEN|AZURE_DEVOPS_ACCESS_TOKEN|AZURE_DEVOPS_EXT_PAT|GITLAB_OAUTH_TOKEN|GITLAB_TOKEN|AI_MARKETPLACE_.*(?:TOKEN|PAT|SECRET|PASSWORD))$/i.test(key)) delete env[key];
  return env;
}

function redact(value: string): string {
  return value.replace(/(?:ghp|github_pat|glpat|azdopat)_[A-Za-z0-9_-]+/gi, "[REDACTED]")
    .replace(/(authorization:\s*(?:basic|bearer)\s+)[A-Za-z0-9._~+/=-]+/ig, "$1[REDACTED]");
}
