#!/usr/bin/env node
import { runMarketplaceCli } from "./cli.js";
import type { MarketplaceCliHostPolicy } from "./config.js";

export const claudeHostPolicy: MarketplaceCliHostPolicy = {
  platform: "claude",
  displayName: "Claude Code",
  configFileName: "claude.json",
  mcpConfigRelativePath: ".claude.json",
  supportedScopes: ["workspace", "global"]
};

void runMarketplaceCli(process.argv.slice(2), claudeHostPolicy).then((exitCode) => {
  process.exitCode = exitCode;
});
