import { type InstalledPackage, type MarketplaceConfig } from "../types/packages";
import { installRelativePath, offloadRelativePath } from "./pathPlanning";

export function uninstallTargetPaths(installed: InstalledPackage, config: MarketplaceConfig): readonly string[] {
  return uniquePaths([
    installed.installedPath,
    installRelativePath(installed.platform, installed.type, installed.id, config.platformPathOverrides),
    ...(installed.managedConfig?.kind === "codex-agent" ? [installed.managedConfig.configPath] : []),
    offloadRelativePath(installed.platform, installed.type, installed.id)
  ]);
}

function uniquePaths(paths: readonly string[]): readonly string[] {
  return [...new Set(paths)];
}
