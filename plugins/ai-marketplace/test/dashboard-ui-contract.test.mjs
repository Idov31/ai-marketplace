import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardRoot = new URL("../dashboard/", import.meta.url);
const [html, script] = await Promise.all([
  readFile(new URL("index.html", dashboardRoot), "utf8"),
  readFile(new URL("app.js", dashboardRoot), "utf8")
]);

test("dashboard binds the frozen model and route contract", () => {
  for (const field of ["model.rows", "model.facets.types", "model.facets.groups", "model.facets.sources", "model.knownGroups", "model.refresh.warnings", "refresh.state"]) {
    assert.match(script, new RegExp(escapeRegExp(field)));
  }
  assert.match(script, /tab: state\.view/);
  assert.match(script, /model\.tab !== state\.view/);
  assert.doesNotMatch(script, /function rowsForView/);
  assert.match(script, /addParam\(params, "sourceId"/);
  assert.doesNotMatch(script, /new URLSearchParams\(\{\s*view:/);
  assert.doesNotMatch(script, /addParam\(params, "source",/);

  for (const route of ["/api/model?", "/api/packages/", "/api/plans", "/apply", "/api/refresh", "/api/diagnose", "/api/heartbeat", "/api/events"]) {
    assert.ok(script.includes(route), `missing ${route}`);
  }
  assert.doesNotMatch(script, /\/api\/detail\//);
  assert.doesNotMatch(script, /api\("\/api\/apply"/);
});

test("all supported mutations are represented by exact plan request actions", () => {
  for (const action of [
    "install", "update", "migrate", "revert", "uninstall", "hotload", "offload", "install-group", "sync",
    "set-preferences", "source-add", "source-update", "source-remove"
  ]) {
    assert.ok(script.includes(`"${action}"`), `missing action ${action}`);
  }
  assert.match(script, /const request = \{ action: normalizedAction, identities \}/);
  assert.match(script, /`\/api\/plans\/\$\{encodeURIComponent\(plan\.planId\)\}\/apply`/);
  assert.doesNotMatch(script, /\btargets\s*:/);
  assert.doesNotMatch(script, /\boptions\s*:/);
});

test("exact plan review gates application behind explicit confirmation", () => {
  assert.match(html, /id="plan-dialog"/);
  assert.match(html, /id="confirm-plan"[^>]*type="button"/);
  assert.match(script, /elements\["confirm-plan"\]\.addEventListener\("click", \(\) => void applyCurrentPlan\(\)\)/);
  assert.match(script, /for \(const item of items\)/);
  assert.match(script, /for \(const affected of item\.paths\)/);
  assert.match(script, /affected\.scope/);
  assert.match(script, /affected\.effect/);
  assert.match(script, /affected\.path/);
  assert.match(script, /appendPlanIssueSection\(content, "Skipped", plan\.skipped\)/);
  assert.match(script, /appendPlanIssueSection\(content, "Ineligible", plan\.ineligible\)/);
  assert.match(script, /const hasIneligible = plan\.ineligible\.length > 0/);
  assert.match(script, /elements\["confirm-plan"\]\.disabled = !plan\.planId \|\| plan\.items\.length === 0 \|\| hasIneligible/);
  assert.match(script, /Remove ineligible selections and create a new plan/);
  assert.match(script, /for \(const change of item\.changes\)/);
  assert.match(script, /reviewValue\(change\.before\)/);
  assert.match(script, /reviewValue\(change\.after\)/);

  const applyMarker = "encodeURIComponent(plan.planId)}/apply";
  const applyIndex = script.indexOf(applyMarker);
  const confirmFunctionIndex = script.indexOf("async function applyCurrentPlan()");
  assert.ok(confirmFunctionIndex >= 0 && applyIndex > confirmFunctionIndex, "apply must only occur in the confirmation handler");
  assert.equal(script.indexOf(applyMarker, applyIndex + 1), -1, "apply must have one controlled call site");
});

test("source-qualified identity is used for details, selection, and lifecycle plans", () => {
  assert.match(script, /return `\$\{row\.sourceId \?\? "legacy"\}:\$\{row\.qualifiedName\}`/);
  assert.match(script, /encodeURIComponent\(row\.sourceId \?\? "legacy"\)/);
  assert.match(script, /encodeURIComponent\(row\.qualifiedName\)/);
  assert.match(script, /new URLSearchParams\(\{ kind: row\.kind \}\)/);
  assert.match(script, /if \(row\.kind === "installed"\) detailQuery\.set\("scope", row\.scope\)/);
  assert.match(script, /const identities = rows\.map\(identityOf\)/);
});

test("apply failures consume the reviewed UI plan and require replanning", () => {
  const apply = script.slice(script.indexOf("async function applyCurrentPlan()"), script.indexOf("async function refreshCatalog()"));
  assert.match(apply, /catch \(error\) \{[\s\S]*elements\["plan-dialog"\]\.close\(\)/);
  assert.match(apply, /state\.currentPlan = null/);
  assert.match(apply, /Create and review a new plan before retrying/);
  assert.match(apply, /await loadModel\(\)/);
  assert.doesNotMatch(apply, /elements\["confirm-plan"\]\.disabled = false/);
});

test("bulk controls require every selected row to support the action and scope", () => {
  assert.match(script, /function rowSupportsAction\(row, action, scope\)/);
  assert.match(script, /candidate\.disabled \|\| normalizeLifecycleAction\(candidate\.action\) !== action/);
  assert.match(script, /button\.disabled = rows\.length === 0 \|\| eligible !== rows\.length/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
