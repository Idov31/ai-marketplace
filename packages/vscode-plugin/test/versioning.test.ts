import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareVersions, isSemanticVersion, isUpdateAvailable } from "../src/services/versioning";

describe("versioning", () => {
  it("compares numeric versions by segment", () => {
    assert.equal(compareVersions("1.10.0", "1.2.0"), 1);
    assert.equal(compareVersions("1.0.0", "1.0"), 0);
    assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  });

  it("detects update availability", () => {
    assert.equal(isUpdateAvailable("1.0.0", "1.1.0"), true);
    assert.equal(isUpdateAvailable("1.1.0", "1.1.0"), false);
    assert.equal(isUpdateAvailable("1.2.0", "1.1.0"), false);
  });

  it("uses SemVer precedence when both versions are valid", () => {
    assert.equal(compareVersions("1.0.0-alpha", "1.0.0-alpha.1"), -1);
    assert.equal(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.beta"), -1);
    assert.equal(compareVersions("1.0.0-beta.11", "1.0.0-rc.1"), -1);
    assert.equal(compareVersions("1.0.0+build.1", "1.0.0+build.2"), 0);
  });

  it("rejects malformed SemVer and retains legacy comparison fallback", () => {
    assert.equal(isSemanticVersion("1.2.3-alpha.1+build.7"), true);
    assert.equal(isSemanticVersion("1.2.3-01"), false);
    assert.equal(isSemanticVersion("01.2.3"), false);
    assert.equal(compareVersions("release-10", "release-2"), 1);
  });
});
