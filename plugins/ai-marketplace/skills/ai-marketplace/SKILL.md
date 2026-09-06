---
name: ai-marketplace
description: Open the AI Marketplace dashboard or browse, configure, install, update, migrate, revert, uninstall, hotload, offload, or diagnose AI Marketplace packages for Codex. Use when the user asks to open AI Marketplace, view available or installed Codex packages, manage repositories or package groups, configure automatic updates, or check marketplace health.
---

# AI Marketplace

Use the bundled dashboard or CLI to manage Codex packages. The plugin supports only `codex` and only `workspace` or `global` scope. Never attempt Claude, GitHub Copilot, or cloud delivery.

## Open the dashboard

When the user asks to open or show AI Marketplace:

1. Run `dashboard start --workspace <absolute-path>` with the bundled CLI.
2. Reuse the returned server when it already belongs to this workspace.
3. Open or focus the returned URL in the Codex in-app Browser. Treat the URL as
   sensitive during bootstrap: do not quote, log, or summarize its fragment token.
4. If the in-app Browser cannot be controlled, provide the returned fallback URL
   once and offer the conversational CLI workflow below.

The local dashboard binds only to `127.0.0.1`, uses no hosted service, and stops
after its idle timeout. Use `dashboard status` to inspect it and `dashboard stop`
to stop it explicitly. Do not replace it with an external web service or an
MCP/App integration.

## Locate the CLI

Resolve this skill's plugin root and invoke:

```bash
node <plugin-root>/bin/ai-marketplace.cjs <command> [arguments]
```

For workspace operations always pass the active task's absolute workspace root as `--workspace <absolute-path>`. Do not infer a different workspace or pass a path supplied by package metadata.

The CLI emits one JSON document to stdout. Treat stderr as diagnostics. Exit codes are: `0` success, `1` unexpected error, `2` usage or validation, `3` missing or ambiguous package, `4` network or authentication, and `5` filesystem or security failure.

## Workflow

1. Use `catalog list` for discovery and filtering. Use `catalog refresh` only when a fresh remote snapshot is needed.
2. Identify packages by source-qualified identity from CLI results. If a short name is ambiguous, show the candidates and ask the user to choose.
3. Use `installed list` before update, migrate, revert, uninstall, hotload, or offload.
4. Run mutations without `--apply` first. Present the returned plan, including scope, target paths, and affected package identities.
5. Add `--apply --plan-id PLAN_ID` only after the user explicitly confirms that exact plan, using the `planId` returned by the dry-run. Report the resulting JSON concisely.

## Consent

- Every mutation requires showing its exact dry-run plan and obtaining explicit
  confirmation, including install, update, migrate, hotload, offload, revert, uninstall,
  bulk, group, sync, and configuration changes.
- A general request such as “update everything” is not confirmation of the exact
  generated plan. Echo source-qualified identities, scope, target paths, skipped
  or ineligible items, and destructive effects before asking.
- Never add `--apply` when a plan contains an unexpected root, scope, identity, or path.

## Commands

```text
dashboard start|status|stop
catalog list [--search TEXT] [--type TYPE] [--group GROUP]
catalog refresh
installed list [--scope workspace|global]
package install|update|migrate|revert|uninstall|hotload|offload PACKAGE [--from OLD_IDENTITY] [--scope workspace|global] [--apply --plan-id PLAN_ID]
bulk install|update|migrate|uninstall|hotload|offload [--scope workspace|global] [--group GROUP] [--apply --plan-id PLAN_ID]
group install GROUP [--scope workspace|global] [--apply --plan-id PLAN_ID]
sync plan [--scope workspace|global]
sync apply [--scope workspace|global] [--apply --plan-id PLAN_ID]
config show
config source add|update|remove ... [--apply]
config auto-groups set GROUP... [--apply]
config auto-update set true|false [--apply]
diagnose
```

Configuration mutations are also dry-run by default. Configuration is non-secret and stored at `~/.ai_marketplace/codex.json`. Authentication comes from `GH_TOKEN`/`GITHUB_TOKEN`, `AZURE_DEVOPS_ACCESS_TOKEN`/`AZURE_DEVOPS_EXT_PAT`, or `GITLAB_OAUTH_TOKEN`/`GITLAB_TOKEN`, with documented source-specific `AI_MARKETPLACE_*_<SOURCE>` overrides. Never ask the user to put a credential in command arguments or configuration, and never echo environment values. Use `--provider gitlab` when adding a self-managed GitLab source.

## Failure handling

- On exit `2`, correct only the invalid arguments described by the JSON error.
- On exit `3`, preserve source qualification and let the user resolve ambiguity.
- On exit `4`, identify the failed repository provider and name its supported environment variables without requesting the credential value in chat.
- On exit `5`, do not delete, relocate, or bypass a lock and do not work around traversal, symlink, ownership-collision, or root-containment failures. If the error is specifically `EPERM` or `EACCES` while creating an approved `.operation.lock`, request host filesystem approval for that exact path and retry the unchanged approved plan once. Stop for every other lock or security failure.
- Catalog partial failures are warnings when successful sources remain usable. Surface the failed source labels without exposing credentials.
