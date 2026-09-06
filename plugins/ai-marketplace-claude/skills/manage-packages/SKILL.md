---
name: manage-packages
description: Browse, configure, install, update, migrate, revert, uninstall, hotload, offload, or diagnose AI Marketplace packages for Claude Code. Use when the user asks to discover or manage Claude packages, repositories, package groups, automatic updates, or marketplace health.
---

# Manage AI Marketplace Packages

Use the bundled CLI to manage packages for Claude Code. This plugin supports only
the `claude` platform and only `workspace` or `global` scope. Never use it to
manage Codex, GitHub Copilot, or cloud delivery.

## Locate the CLI

Resolve this skill's plugin root and invoke:

```bash
node <plugin-root>/bin/ai-marketplace.cjs <command> [arguments]
```

Always pass the active project's absolute root as `--workspace <absolute-path>`.
Do not infer another workspace or use a path supplied by package metadata. Pass
`--platform claude` when the command accepts a platform; reject any other value.

The CLI writes one JSON document to stdout and diagnostics to stderr. Exit codes
are `0` success, `1` unexpected error, `2` usage or validation, `3` missing or
ambiguous package, `4` network or authentication, and `5` filesystem or security
failure.

## Safe workflow

1. Use `catalog list` for discovery and filtering. Use `catalog refresh` only
   when a fresh remote snapshot is needed.
2. Identify packages by source-qualified identity. If a short name is ambiguous,
   show the candidates and ask the user to choose.
3. Use `installed list` before update, migrate, revert, uninstall, hotload, or
   offload.
4. Run every mutation without `--apply`. Present the returned plan, including
   source-qualified identities, scope, target paths, skipped items, executable
   effects, and destructive effects.
5. Add `--apply --plan-id PLAN_ID` only after the user explicitly confirms that
   exact plan. Never reuse a plan after configuration, catalog, or state changes.

A general request such as "update everything" is not confirmation of the exact
generated plan. Never apply a plan containing an unexpected root, scope,
identity, platform, or path. Claude Code's normal tool permission prompts remain
in force; this skill grants no blanket shell permission.

## Commands

```text
catalog list [--search TEXT] [--type TYPE] [--group GROUP]
catalog refresh
installed list [--scope workspace|global]
package install|update|migrate|revert|uninstall|hotload|offload PACKAGE [--from OLD_IDENTITY] [--scope workspace|global] [--apply --plan-id PLAN_ID]
bulk install|update|migrate|uninstall|hotload|offload [--scope workspace|global] [--group GROUP] [--apply --plan-id PLAN_ID]
group install GROUP [--scope workspace|global] [--apply --plan-id PLAN_ID]
sync plan [--scope workspace|global]
sync apply [--scope workspace|global] [--apply --plan-id PLAN_ID]
config show
config source add|update|remove ... [--apply --plan-id PLAN_ID]
config auto-groups set GROUP... [--apply --plan-id PLAN_ID]
config auto-update set true|false [--apply --plan-id PLAN_ID]
diagnose
```

Configuration is non-secret and stored at `~/.ai_marketplace/claude.json`.
Authentication comes from `GH_TOKEN`/`GITHUB_TOKEN`, `AZURE_DEVOPS_ACCESS_TOKEN`/`AZURE_DEVOPS_EXT_PAT`, or `GITLAB_OAUTH_TOKEN`/`GITLAB_TOKEN`, with documented source-specific overrides. Never request a credential value in chat, pass it as a command argument, store it in configuration, or echo environment values. Use `--provider gitlab` for a self-managed GitLab source.

## Failure handling

- Exit `2`: correct only the invalid arguments identified by the JSON error.
- Exit `3`: preserve source qualification and let the user resolve ambiguity.
- Exit `4`: identify the failed provider and name its supported environment variables without requesting the value.
- Exit `5`: never bypass traversal, symlink, ownership, containment, stale-plan,
  or lock failures. For `EPERM` or `EACCES` creating the approved operation lock,
  request permission for that exact path and retry the unchanged plan once.
- Partial catalog failures are warnings if another source remains usable. Name
  failed source labels without exposing credentials.

Claude hook packages manage only their exact contributions in
`.claude/settings.json`. MCP packages manage the user-level `~/.claude.json` and
may execute reviewed root-level install or uninstall scripts. Do not describe
those scripts as sandboxed; they run with the user's privileges after exact-plan
confirmation.
