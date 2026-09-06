import { MarketplaceCliError, runMarketplaceCli, type CliIo, type MarketplaceCliCommandHandler } from "@ai-marketplace/node-cli";
import { codexHostPolicy } from "./config.js";
import { dashboardServe, dashboardStart, dashboardStatus, dashboardStop } from "./dashboardCli.js";

export type { CliIo };
export { filesystemErrorMessage } from "@ai-marketplace/node-cli";

const dashboardCommand: MarketplaceCliCommandHandler = async (parsed, context) => {
  if (!new Set(["start", "status", "stop", "serve"]).has(parsed.action ?? "") || parsed.values.length > 0) throw new MarketplaceCliError(2, "Usage: dashboard start|status|stop");
  if (parsed.action === "start") return dashboardStart(context);
  if (parsed.action === "status") return dashboardStatus(context);
  if (parsed.action === "stop") return dashboardStop(context);
  return dashboardServe(context);
};

export function runCli(argv: readonly string[], io?: CliIo): Promise<number> {
  return runMarketplaceCli(argv, codexHostPolicy, io, { commands: { dashboard: dashboardCommand } });
}
