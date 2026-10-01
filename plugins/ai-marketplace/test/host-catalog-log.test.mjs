import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const output = fileURLToPath(new URL("../.test-build/host-catalog-log.cjs", import.meta.url));
await build({ entryPoints: [fileURLToPath(new URL("../src/hostSidecar.ts", import.meta.url))], outfile: output, bundle: true, platform: "node", format: "cjs", target: "node22" });
const { createHostCatalogLogger } = createRequire(import.meta.url)(output);

test("Visual Studio catalog progress goes to diagnostics, not the warning banner", () => {
  const diagnostics = []; const warnings = [];
  const logger = createHostCatalogLogger((line) => diagnostics.push(line), warnings, (line) => line);
  const routine = [
    "Loaded package @team/demo (skill) from source team at Skills/demo/ai_marketplace.yaml.",
    "Source team package folder Skills: 302 item(s), 29 AI Marketplace manifest candidate(s).",
    "Skipping missing package folder Agents.",
    "Finished parsing source 'Team': 29 package(s).",
    "Listing GitHub tree: source=team",
    "Retrying GitHub request with the configured credential override"
  ];
  for (const line of routine) logger.log(line);
  assert.deepEqual(diagnostics, routine);
  assert.deepEqual(warnings, []);
  const actionable = [
    "Unable to refresh source 'team': authentication failed",
    "Skipping invalid package at Skills/broken: invalid manifest"
  ];
  for (const line of actionable) logger.log(line);
  assert.deepEqual(diagnostics, [...routine, ...actionable]);
  assert.deepEqual(warnings, actionable);
});

test("catalog logging redacts before either diagnostic or warning output", () => {
  const diagnostics = []; const warnings = [];
  const logger = createHostCatalogLogger((line) => diagnostics.push(line), warnings, (line) => line.replace("sensitive-marker", "[redacted]"));
  logger.log("Loaded package sensitive-marker");
  logger.log("Unable to refresh source 'team': sensitive-marker");
  assert.deepEqual(diagnostics, ["Loaded package [redacted]", "Unable to refresh source 'team': [redacted]"]);
  assert.deepEqual(warnings, ["Unable to refresh source 'team': [redacted]"]);
});
