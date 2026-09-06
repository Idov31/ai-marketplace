import { existsSync } from "node:fs";
import { posix, win32 } from "node:path";

export function npmCliCandidates(execPath = process.execPath, npmExecPath = process.env.npm_execpath) {
  const pathApi = /^[A-Za-z]:[\\/]/.test(execPath) || execPath.includes("\\") ? win32 : posix;
  const executableDirectory = pathApi.dirname(execPath);
  return [
    npmExecPath,
    pathApi.join(executableDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
    pathApi.join(pathApi.dirname(executableDirectory), "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter((candidate) => typeof candidate === "string" && candidate.length > 0);
}

export function resolveNpmCli(options = {}) {
  const candidates = npmCliCandidates(options.execPath, options.npmExecPath);
  const exists = options.exists ?? existsSync;
  const resolved = candidates.find((candidate) => exists(candidate));
  if (resolved) return resolved;
  throw new Error(`Unable to locate npm-cli.js. Checked: ${candidates.join(", ")}`);
}
