import type { MarketplaceStorage } from "@ai-marketplace/core";
import {
  configPath as sharedConfigPath,
  defaultPackageFolders,
  readHostConfig,
  toMarketplaceConfig as toSharedMarketplaceConfig,
  writeHostConfig,
  type MarketplaceCliConfigFile,
  type MarketplaceCliHostPolicy,
  type MarketplaceCliRepository
} from "@ai-marketplace/node-cli";

export type CodexConfigFile = MarketplaceCliConfigFile;
export type CodexRepository = MarketplaceCliRepository;
export { defaultPackageFolders };

export const codexHostPolicy: MarketplaceCliHostPolicy = {
  platform: "codex",
  displayName: "Codex",
  configFileName: "codex.json",
  mcpConfigRelativePath: ".codex/config.toml",
  supportedScopes: ["workspace", "global"]
};

export function configPath(home: string): string { return sharedConfigPath(home, codexHostPolicy); }
export function readCodexConfig(storage: MarketplaceStorage): Promise<CodexConfigFile> { return readHostConfig(storage, codexHostPolicy); }
export function writeCodexConfig(storage: MarketplaceStorage, config: CodexConfigFile): Promise<void> { return writeHostConfig(storage, codexHostPolicy, config); }
export function toMarketplaceConfig(raw: CodexConfigFile) { return toSharedMarketplaceConfig(raw, codexHostPolicy); }
