#!/usr/bin/env python3
"""Validate the repository's distributable Claude Code plugin and marketplace."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugins" / "ai-marketplace-claude"
MANIFEST = PLUGIN / ".claude-plugin" / "plugin.json"
MARKETPLACE = ROOT / ".claude-plugin" / "marketplace.json"
SKILL = PLUGIN / "skills" / "manage-packages" / "SKILL.md"
SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")
ALLOWED_ROOTS = {
    ".claude-plugin", "bin", "schemas", "skills", "LICENSE", "PRIVACY.md", "README.md",
    "SUPPORT.md", "TERMS.md", "package.json",
}


def fail(message: str) -> None:
    raise ValueError(message)


def load_json(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        fail(f"{path.relative_to(ROOT)} must contain a JSON object")
    return value


def nonempty_string(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        fail(f"{field} must be a non-empty string")
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--allow-missing-bundle",
        action="store_true",
        help="validate source metadata before the shared CLI build copies its bundle",
    )
    args = parser.parse_args()

    for required in (MANIFEST, MARKETPLACE, SKILL, PLUGIN / "package.json"):
        if not required.is_file():
            fail(f"missing {required.relative_to(ROOT)}")

    manifest = load_json(MANIFEST)
    if manifest.get("name") != "ai-marketplace":
        fail("Claude plugin name must be ai-marketplace")
    version = nonempty_string(manifest.get("version"), "plugin.version")
    if not SEMVER.fullmatch(version):
        fail("plugin.version must be strict semver")
    nonempty_string(manifest.get("description"), "plugin.description")
    if manifest.get("license") != "GPL-3.0-only":
        fail("plugin.license must be GPL-3.0-only")
    author = manifest.get("author")
    if not isinstance(author, dict):
        fail("plugin.author must be an object")
    nonempty_string(author.get("name"), "plugin.author.name")
    for forbidden in ("commands", "hooks", "mcpServers", "agents"):
        if forbidden in manifest:
            fail(f"runtime plugin must not declare {forbidden}")

    marketplace = load_json(MARKETPLACE)
    if marketplace.get("name") != "ai-marketplace":
        fail("marketplace name must be ai-marketplace")
    plugins = marketplace.get("plugins")
    if not isinstance(plugins, list) or len(plugins) != 1 or not isinstance(plugins[0], dict):
        fail("marketplace must contain exactly one plugin entry")
    entry = plugins[0]
    expected = {
        "name": "ai-marketplace",
        "version": version,
        "source": "./plugins/ai-marketplace-claude",
    }
    for field, value in expected.items():
        if entry.get(field) != value:
            fail(f"marketplace plugin {field} must be {value!r}")

    package = load_json(PLUGIN / "package.json")
    if package.get("version") != version:
        fail("package and plugin manifest versions must match")
    if package.get("dependencies"):
        fail("Claude plugin must have no runtime npm dependencies")
    files = package.get("files")
    if not isinstance(files, list) or "bin/" not in files or "skills/" not in files or "schemas/" not in files:
        fail("package files must include the bundled CLI, schema, and skills")
    if not (PLUGIN / "schemas" / "ai_marketplace.schema.json").is_file():
        fail("generated manifest schema is missing")

    skill_text = SKILL.read_text(encoding="utf-8")
    required_skill_terms = (
        "name: manage-packages", "--workspace <absolute-path>", "--platform claude",
        "--apply --plan-id", "GH_TOKEN", "GITHUB_TOKEN", "~/.ai_marketplace/claude.json",
    )
    for term in required_skill_terms:
        if term not in skill_text:
            fail(f"manage-packages skill is missing required contract: {term}")
    if "allowed-tools:" in skill_text:
        fail("manage-packages must not grant broad allowed-tools permissions")

    unexpected = sorted(path.name for path in PLUGIN.iterdir() if path.name not in ALLOWED_ROOTS)
    if unexpected:
        fail(f"runtime plugin contains unexpected top-level entries: {', '.join(unexpected)}")
    for forbidden in ("dashboard", "hooks", "src", "test", ".mcp.json"):
        if (PLUGIN / forbidden).exists():
            fail(f"runtime plugin contains forbidden contribution or development content: {forbidden}")

    cli = PLUGIN / "bin" / "ai-marketplace.cjs"
    if not cli.is_file() and not args.allow_missing_bundle:
        fail("bundled CLI is missing; run the shared Claude CLI build first")
    if cli.is_file():
        cli_text = cli.read_text(encoding="utf-8", errors="ignore")
        if "sourceMappingURL=" in cli_text:
            fail("bundled CLI must not reference an external source map")

    print(f"Validated Claude plugin: {PLUGIN}")
    if not cli.is_file():
        print("Bundle check skipped: bin/ai-marketplace.cjs has not been built")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Claude plugin validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
