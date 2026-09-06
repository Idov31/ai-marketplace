#!/usr/bin/env python3
"""Validate the repository's distributable Codex skills plugin."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugins" / "ai-marketplace"
MANIFEST = PLUGIN / ".codex-plugin" / "plugin.json"
SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")


def fail(message: str) -> None:
    raise ValueError(message)


def relative_file(value: object, field: str) -> Path:
    if not isinstance(value, str) or not value.startswith("./"):
        fail(f"{field} must be a ./-relative path")
    candidate = (PLUGIN / value).resolve()
    try:
        candidate.relative_to(PLUGIN.resolve())
    except ValueError:
        fail(f"{field} escapes the plugin root")
    if not candidate.is_file():
        fail(f"{field} does not exist: {value}")
    return candidate


def main() -> int:
    if not MANIFEST.is_file():
        fail("missing .codex-plugin/plugin.json")
    manifest_text = MANIFEST.read_text(encoding="utf-8")
    if "[TODO:" in manifest_text:
        fail("plugin manifest contains a TODO placeholder")
    manifest = json.loads(manifest_text)
    if manifest.get("name") != PLUGIN.name:
        fail("plugin name must match its outer folder")
    if not SEMVER.fullmatch(str(manifest.get("version", ""))):
        fail("plugin version must be strict semver")
    if not isinstance(manifest.get("description"), str) or not manifest["description"].strip():
        fail("plugin description is required")
    author = manifest.get("author")
    if not isinstance(author, dict) or not isinstance(author.get("name"), str) or not author["name"].strip():
        fail("author.name is required")
    if manifest.get("license") != "MIT":
        fail("plugin license must be MIT")
    if "mcpServers" in manifest or "apps" in manifest:
        fail("the public-ready v1 plugin must remain skills-only")
    skills = manifest.get("skills")
    if skills != "./skills/" or not (PLUGIN / "skills" / "ai-marketplace" / "SKILL.md").is_file():
        fail("skills must point to the bundled AI Marketplace skill")
    interface = manifest.get("interface")
    if not isinstance(interface, dict):
        fail("interface metadata is required")
    for field in ("displayName", "shortDescription", "longDescription", "developerName", "category"):
        if not isinstance(interface.get(field), str) or not interface[field].strip():
            fail(f"interface.{field} is required")
    for field in ("websiteURL", "privacyPolicyURL", "termsOfServiceURL"):
        value = interface.get(field)
        if not isinstance(value, str) or not value.startswith("https://"):
            fail(f"interface.{field} must be an absolute HTTPS URL")
    prompts = interface.get("defaultPrompt")
    if not isinstance(prompts, list) or not 1 <= len(prompts) <= 3:
        fail("interface.defaultPrompt must contain one to three prompts")
    if any(not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 128 for prompt in prompts):
        fail("every default prompt must be a non-empty string of at most 128 characters")
    for field in ("composerIcon", "logo"):
        relative_file(interface.get(field), f"interface.{field}")
    skill_text = (PLUGIN / "skills" / "ai-marketplace" / "SKILL.md").read_text(encoding="utf-8")
    if "[TODO:" in skill_text or "--apply" not in skill_text or "GH_TOKEN" not in skill_text:
        fail("skill must be complete and document apply consent and environment authentication")
    if (PLUGIN / ".mcp.json").exists() or (PLUGIN / ".app.json").exists():
        fail("skills-only plugin archive contains an MCP/App companion file")
    dashboard = PLUGIN / "dashboard"
    for name in ("index.html", "styles.css", "app.js"):
        if not (dashboard / name).is_file():
            fail(f"dashboard asset is missing: {name}")
    dashboard_text = "\n".join(
        (dashboard / name).read_text(encoding="utf-8")
        for name in ("index.html", "styles.css", "app.js")
    )
    if re.search(r"(?:src|href)=[\"']https?://", dashboard_text, re.IGNORECASE):
        fail("dashboard must not load external scripts, styles, or images")
    if "Content-Security-Policy" not in dashboard_text or "frame-ancestors 'none'" not in dashboard_text:
        fail("dashboard must declare a strict content security policy")
    package = json.loads((PLUGIN / "package.json").read_text(encoding="utf-8"))
    if package.get("version") != manifest.get("version"):
        fail("plugin manifest and package versions must match")
    if "dashboard/" not in package.get("files", []):
        fail("plugin archive must include dashboard assets")
    if "schemas/" not in package.get("files", []) or not (PLUGIN / "schemas" / "ai_marketplace.schema.json").is_file():
        fail("plugin archive must include the generated manifest schema")
    cli = PLUGIN / "bin" / "ai-marketplace.cjs"
    if not cli.is_file():
        fail("bundled CLI is missing; run the plugin build first")
    print(f"Validated Codex plugin: {PLUGIN}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Codex plugin validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
