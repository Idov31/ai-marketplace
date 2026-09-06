import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterPackageFilesForPlatform } from "../src/services/packageFiles";
import { type PackageFile } from "../src/types/packages";

const files: readonly PackageFile[] = [
  { relativePath: "SKILL.md", content: Buffer.from("skill") },
  { relativePath: "agents/openai.yaml", content: Buffer.from("codex agent") },
  { relativePath: "references/openai.yaml", content: Buffer.from("nested") }
];

describe("package files", () => {
  it("keeps openai.yaml files for codex installs", () => {
    assert.deepEqual(filterPackageFilesForPlatform(files, "codex").map((file) => file.relativePath), [
      "SKILL.md",
      "agents/openai.yaml",
      "references/openai.yaml"
    ]);
  });

  it("removes openai.yaml files for non-codex installs", () => {
    assert.deepEqual(filterPackageFilesForPlatform(files, "github-copilot").map((file) => file.relativePath), [
      "SKILL.md"
    ]);
    assert.deepEqual(filterPackageFilesForPlatform(files, "claude").map((file) => file.relativePath), [
      "SKILL.md"
    ]);
  });
});
