import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Ajv from "ajv";
import {
  canonicalManifestFields, createMarketplaceManifestJsonSchema, isManifestPath, manifestFieldDisposition, parseHotloadFlag, parseMarketplaceYaml,
  selectManifestCandidates, validateMarketplaceManifest, ValidationError
} from "../src/services/validation";

describe("canonical AI Marketplace manifest validation", () => {
  it("normalizes every canonical section and applies defaults", () => {
    const revision = "a".repeat(40);
    const result = validateMarketplaceManifest(canonicalManifest({
      package: { ...canonicalManifest().package as object, group: "Research" },
      installation: { default: true },
      metadata: { tags: ["research", "workflow"], icon: "icon.png", evaluation_score: 8.5 },
      history: { previous_revision: revision, migrations: [{ from: { source_id: "old-source", name: "@research/old-skill" } }] }
    }), "ai_marketplace.yaml");
    assert.equal(result.manifest.id, "my-skill");
    assert.equal(result.manifest.group, "Research");
    assert.equal(result.manifest.defaultInstall, true);
    assert.deepEqual(result.manifest.tags, ["research", "workflow"]);
    assert.equal(result.manifest.icon, "icon.png");
    assert.equal(result.manifest.evaluationScore, 8.5);
    assert.equal(result.manifest.previousVersion, revision);
    assert.deepEqual(result.manifest.migrations?.[0]?.from, { sourceId: "old-source", name: "@research/old-skill" });
    assert.deepEqual(result.compatibility, { schemaVersion: 1, minimumReaderSchemaVersion: 1 });

    const defaults = validateMarketplaceManifest(canonicalManifest(), "ai_marketplace.yaml").manifest;
    assert.equal(defaults.defaultInstall, false);
    assert.deepEqual(defaults.tags, []);
    assert.equal(defaults.group, "team");
  });

  it("rejects flat manifests even when stored under the canonical filename", () => {
    assert.throws(() => validateMarketplaceManifest({ name: "@team/my-skill", type: "skill" }, "ai_marketplace.yaml"), ValidationError);
  });

  it("accepts decimal evaluation scores from zero through ten", () => {
    for (const evaluation_score of [0, 8.5, 10]) {
      const result = validateMarketplaceManifest(canonicalManifest({ metadata: { evaluation_score } }), "ai_marketplace.yaml");
      assert.equal(result.manifest.evaluationScore, evaluation_score);
    }
    for (const evaluation_score of [-0.1, 10.1, "8.5", Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => validateMarketplaceManifest(canonicalManifest({ metadata: { evaluation_score } }), "ai_marketplace.yaml"), /evaluation-score/);
    }
  });

  it("does not treat the removed cost_score field as an evaluation score", () => {
    const result = validateMarketplaceManifest(canonicalManifest({ metadata: { cost_score: 25 } }), "ai_marketplace.yaml");
    assert.equal(result.manifest.evaluationScore, undefined);
    assert.deepEqual(result.diagnostics, [{ kind: "unknown-field", field: "metadata.cost_score" }]);
  });

  it("enforces schema headers, SemVer, and unique collections", () => {
    for (const override of [{ schema_version: 0 }, { minimum_reader_schema_version: 0 }, { schema_version: 1, minimum_reader_schema_version: 2 }]) {
      assert.throws(() => validateMarketplaceManifest(canonicalManifest(override), "ai_marketplace.yaml"), ValidationError);
    }
    for (const version of ["1.0", "01.0.0", "1.0.0-01", "v1.0.0"]) {
      assert.throws(() => validateMarketplaceManifest(canonicalManifest({ package: { ...canonicalManifest().package as object, version } }), "ai_marketplace.yaml"), /SemVer 2.0/);
    }
    assert.throws(() => validateMarketplaceManifest(canonicalManifest({ targets: { platforms: ["codex", "codex"], delivery: ["workspace"] } }), "ai_marketplace.yaml"), /duplicate 'targets.platforms'/);
    assert.throws(() => validateMarketplaceManifest(canonicalManifest({ metadata: { tags: ["same", "same"] } }), "ai_marketplace.yaml"), /duplicate 'metadata.tags'/);
  });

  it("reports unknown forward-compatible fields without their values", () => {
    const secret = "must-not-appear";
    const result = validateMarketplaceManifest(canonicalManifest({ future: secret, package: { ...canonicalManifest().package as object, future_nested: secret } }), "ai_marketplace.yaml");
    assert.deepEqual(result.diagnostics, [
      { kind: "unknown-field", field: "package.future_nested" },
      { kind: "unknown-field", field: "future" }
    ]);
    assert.equal(JSON.stringify(result.diagnostics).includes(secret), false);
  });

  it("recognizes only canonical manifest paths", () => {
    assert.equal(isManifestPath("Skills/one/ai_marketplace.yaml"), true);
    assert.equal(isManifestPath("Skills/one/manifest.yaml"), false);
    assert.deepEqual(selectManifestCandidates([
      "Skills/one/manifest.yaml", "Skills/one/ai_marketplace.yaml", "Skills/two/manifest.yaml"
    ]), [{ path: "Skills/one/ai_marketplace.yaml", sourcePath: "Skills/one" }]);
  });

  it("keeps lifecycle metadata and generated schema valid", () => {
    for (const lifecycle of Object.values(canonicalManifestFields)) {
      assert.deepEqual(Object.keys(lifecycle).sort(), ["deprecatedIn", "introducedIn", "removedIn", "replacement"].sort());
    }
    assert.equal(manifestFieldDisposition({ introducedIn: 1, deprecatedIn: 2, removedIn: 4, replacement: "new" }, 2, true), "prefer-replacement");
    const generated = createMarketplaceManifestJsonSchema() as Record<string, unknown>;
    const { $schema: _dialect, ...schema } = generated;
    const validate = new Ajv({ allErrors: true, schemaId: "auto" }).compile(schema);
    assert.equal(validate(canonicalManifest()), true, JSON.stringify(validate.errors));
    assert.equal(validate(canonicalManifest({ package: { ...canonicalManifest().package as object, version: "1.0.0-01" } })), false);
  });
});

describe("strict AI Marketplace YAML parsing", () => {
  it("parses mappings and rejects unsafe YAML", () => {
    assert.equal(parseMarketplaceYaml("schema_version: 1\n", "ai_marketplace.yaml").schema_version, 1);
    assert.throws(() => parseMarketplaceYaml("name: one\nname: two\n", "ai_marketplace.yaml"), ValidationError);
    assert.throws(() => parseMarketplaceYaml("base: &base {x: 1}\ncopy: *base\n", "ai_marketplace.yaml"), ValidationError);
    assert.throws(() => parseMarketplaceYaml("- one\n- two\n", "ai_marketplace.yaml"), ValidationError);
  });
});

describe("prologue parsing", () => {
  it("enables hotload only when the entrypoint prologue declares it", () => {
    assert.equal(parseHotloadFlag("---\nhotload: true\n---\n# Skill"), true);
    assert.equal(parseHotloadFlag("# Title\n\nLater text\nhotload: true"), false);
  });
});

function canonicalManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    minimum_reader_schema_version: 1,
    package: { name: "@team/my-skill", type: "skill", version: "1.2.3", description: "Useful skill", entrypoint: "SKILL.md" },
    targets: { platforms: ["codex", "cursor"], delivery: ["workspace", "global"] },
    ...overrides
  };
}
