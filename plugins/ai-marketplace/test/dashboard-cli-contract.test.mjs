import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const output = fileURLToPath(new URL("../.test-build/dashboard-cli-contract.cjs", import.meta.url));
await build({
  entryPoints: [fileURLToPath(new URL("../src/dashboardCli.ts", import.meta.url))],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: false
});
const { isDashboardRefreshWarning } = createRequire(import.meta.url)(output);

test("dashboard refresh reports only actionable catalog warnings", () => {
  for (const routine of [
    "Listing GitHub tree: source=default",
    "Loaded package @team/demo (skill) from source default",
    "Retrying GitHub request with the configured credential override",
    "Source default package folder Skills/: 1 item(s)"
  ]) assert.equal(isDashboardRefreshWarning(routine), false, routine);

  for (const warning of [
    "Unable to refresh source 'private': authentication failed",
    "Skipping invalid package at Skills/broken: invalid manifest",
    "Skipping Skills/demo/ai_marketplace.yaml: manifest type does not match containing folder"
  ]) assert.equal(isDashboardRefreshWarning(warning), true, warning);
});
