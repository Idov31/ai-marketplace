import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const output = fileURLToPath(new URL("../.test-build/mcp-script-runner.cjs", import.meta.url));
await build({ stdin: { contents: 'export { NodeMcpScriptRunner } from "./mcpScriptRunner.js"; export { NodeMarketplaceStorage } from "./nodeStorage.js";', resolveDir: fileURLToPath(new URL("../src", import.meta.url)), sourcefile: "mcp-runner-test-entry.ts", loader: "ts" }, outfile: output, bundle: true, platform: "node", format: "cjs", target: "node22", sourcemap: false });
const { NodeMcpScriptRunner, NodeMarketplaceStorage } = createRequire(import.meta.url)(output);

test("MCP script runner passes reviewed arguments, strips GitHub tokens, and enforces timeout", async (t) => {
  const python = process.platform === "win32" ? spawnSync("py", ["-3", "--version"]) : spawnSync("python3", ["--version"]);
  if (python.status !== 0) return t.skip("Python is unavailable in the test environment");
  const root = await mkdtemp(join(tmpdir(), "ai-marketplace-mcp-runner-"));
  const home = join(root, "home");
  const workspace = join(root, "workspace");
  await mkdir(home); await mkdir(workspace);
  const storage = new NodeMarketplaceStorage(workspace, home);
  await storage.validateRoots();
  const packagePath = ".ai_marketplace/mcp-packages/codex/source/demo";
  const script = [
    "import json, os, pathlib, sys",
    "pathlib.Path('result.json').write_text(json.dumps({'args': sys.argv[1:], 'cwd': pathlib.Path.cwd().name, 'gh': os.getenv('GH_TOKEN'), 'github': os.getenv('GITHUB_TOKEN'), 'azure': os.getenv('AZURE_DEVOPS_ACCESS_TOKEN'), 'gitlab': os.getenv('GITLAB_TOKEN')}))"
  ].join("\n");
  await storage.replaceDirectory("global", packagePath, [{ relativePath: "install.py", content: Buffer.from(script) }]);
  const previousGh = process.env.GH_TOKEN;
  const previousGithub = process.env.GITHUB_TOKEN;
  const previousAzure = process.env.AZURE_DEVOPS_ACCESS_TOKEN;
  const previousGitLab = process.env.GITLAB_TOKEN;
  process.env.GH_TOKEN = "ghp_must_not_reach_script";
  process.env.GITHUB_TOKEN = "github_pat_must_not_reach_script";
  process.env.AZURE_DEVOPS_ACCESS_TOKEN = "azure_must_not_reach_script";
  process.env.GITLAB_TOKEN = "gitlab_must_not_reach_script";
  try {
    await new NodeMcpScriptRunner(storage).run({ scope: "global", packagePath, script: "install.py", action: "update", platform: "codex", timeoutMs: 5_000 });
  } finally {
    if (previousGh === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = previousGh;
    if (previousGithub === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = previousGithub;
    if (previousAzure === undefined) delete process.env.AZURE_DEVOPS_ACCESS_TOKEN; else process.env.AZURE_DEVOPS_ACCESS_TOKEN = previousAzure;
    if (previousGitLab === undefined) delete process.env.GITLAB_TOKEN; else process.env.GITLAB_TOKEN = previousGitLab;
  }
  const result = JSON.parse(await readFile(join(home, packagePath, "result.json"), "utf8"));
  assert.deepEqual(result.args, ["--action", "update", "--platform", "codex"]);
  assert.equal(result.cwd, "demo");
  assert.equal(result.gh, null);
  assert.equal(result.github, null);
  assert.equal(result.azure, null);
  assert.equal(result.gitlab, null);

  await storage.replaceDirectory("global", packagePath, [{ relativePath: "install.py", content: Buffer.from("import time\ntime.sleep(2)") }]);
  await assert.rejects(
    new NodeMcpScriptRunner(storage).run({ scope: "global", packagePath, script: "install.py", action: "install", platform: "codex", timeoutMs: 50 }),
    /timed out/
  );

  await storage.replaceDirectory("global", packagePath, [{ relativePath: "install.py", content: Buffer.from("import sys\nprint('ghp_should_be_redacted', file=sys.stderr)\nsys.exit(3)") }]);
  await assert.rejects(
    new NodeMcpScriptRunner(storage).run({ scope: "global", packagePath, script: "install.py", action: "install", platform: "codex", timeoutMs: 5_000 }),
    (error) => /exit code 3/.test(error.message) && /\[REDACTED\]/.test(error.message) && !/ghp_should_be_redacted/.test(error.message)
  );
});
