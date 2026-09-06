import type { MarketplacePackage, PackageFile } from "../types/packages";
import { ValidationError } from "./validation";

export const mcpInstallScript = "install.py" as const;
export const mcpUninstallScript = "uninstall.py" as const;
export const mcpScriptTimeoutMs = 10 * 60 * 1000;

export function assertMcpPackageScripts(pkg: MarketplacePackage, files: readonly PackageFile[]): void {
  if (pkg.manifest.type !== "mcp") return;
  const paths = new Set(files.map((file) => file.relativePath));
  assertMcpScriptPaths(pkg.manifestPath, paths);
}

export function assertMcpScriptPaths(source: string, paths: ReadonlySet<string>): void {
  for (const script of [mcpInstallScript, mcpUninstallScript]) {
    if (!paths.has(script)) {
      throw new ValidationError(`MCP package at ${source} must contain root-level '${script}'.`);
    }
  }
}
