import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { installOptionsForPackage, validateHarnessBundle, validateMarketplaceManifest, type MarketplacePackage, type PackageFile } from "../src";

const bytes = (content: string): Uint8Array => Buffer.from(content, "utf8");

function pkg(type: MarketplacePackage["manifest"]["type"] = "command"): MarketplacePackage {
  return {
    manifest: {
      id: "example", qualifiedName: "@team/example", name: "@team/example", group: "team", type,
      version: "1.0.0", description: "Example", platforms: ["deepseek-harness"], delivery: ["global"],
      entrypoint: "package.json", tags: []
    },
    sourcePath: "/Commands/example", manifestPath: "/Commands/example/ai_marketplace.yaml", hotload: false,
    source: { id: "team", label: "Team", provider: "github", repository: "repo", branch: "main", host: "github.com", owner: "team" }
  };
}

function bundleFiles(overrides: Partial<Record<"manifest" | "patch", string>> = {}): PackageFile[] {
  return [
    { relativePath: "package.json", content: bytes(overrides.manifest ?? JSON.stringify({ name: "dsh-example", version: "1.0.0", main: "index.js", dsh: { bundle: { patch: "./cordis.patch.yml" } } })) },
    { relativePath: "cordis.patch.yml", content: bytes(overrides.patch ?? "- insert:\n    - id: example\n      name: dsh-example\n") },
    { relativePath: "index.js", content: bytes("export function apply() {}\n") }
  ];
}

describe("DeepSeek Harness manifest and bundle validation", () => {
  it("accepts each bundle package type and rejects malformed bundle declarations", () => {
    for (const type of ["command", "mcp", "agent", "hook"] as const) {
      assert.equal(validateHarnessBundle(pkg(type), bundleFiles()).name, "dsh-example");
    }
    assert.throws(() => validateHarnessBundle(pkg(), bundleFiles({ manifest: "{" })), /invalid package.json/);
    assert.throws(() => validateHarnessBundle(pkg(), bundleFiles({ patch: "[unterminated" })), /invalid or empty/);
    assert.throws(() => validateHarnessBundle(pkg(), bundleFiles({ patch: "- insert:\n    - id: other\n      name: other-package\n" })), /contribution/);
    assert.throws(() => validateHarnessBundle(pkg(), bundleFiles({ manifest: JSON.stringify({ name: "dsh-example", version: "1.0.0", main: "index.js", exports: { "./client": "./missing.js" }, dsh: { bundle: { patch: "./cordis.patch.yml" }, client: { platform: "web" } } }) })), /missing referenced file/);
    assert.throws(() => validateHarnessBundle(pkg(), bundleFiles({ manifest: JSON.stringify({ name: "dsh-example", version: "1.0.0", scripts: { prepare: "node build.js" }, dsh: { bundle: { patch: "./cordis.patch.yml" } } }) })), /prebuilt/);
    assert.throws(() => validateHarnessBundle(pkg(), [{ relativePath: "../escape", content: bytes("x") }, ...bundleFiles()]), /Unsafe/);
  });

  it("filters unsupported Harness delivery without removing valid delivery for other targets", () => {
    const mixed = { ...pkg("command"), manifest: { ...pkg("command").manifest, platforms: ["codex", "deepseek-harness"] as const, delivery: ["workspace", "global"] as const } };
    const options = installOptionsForPackage(mixed, [], "deepseek-harness");
    assert.equal(options.find((option) => option.scope === "workspace")?.platform, "codex");
    assert.equal(options.find((option) => option.scope === "global")?.platform, "deepseek-harness");
  });

  it("rejects Harness-only cloud and workspace bundle delivery", () => {
    const value = {
      schema_version: 1, minimum_reader_schema_version: 1,
      package: { name: "@team/example", type: "agent", version: "1.0.0", description: "Example", entrypoint: "package.json" },
      targets: { platforms: ["deepseek-harness"], delivery: ["cloud"] }
    };
    assert.throws(() => validateMarketplaceManifest(value, "ai_marketplace.yaml"), /cloud delivery for DeepSeek Harness/);
    assert.throws(() => validateMarketplaceManifest({ ...value, targets: { ...value.targets, delivery: ["workspace"] } }, "ai_marketplace.yaml"), /only global delivery/);
  });
});
