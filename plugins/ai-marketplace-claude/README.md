# AI Marketplace for Claude Code

AI Marketplace is a local Claude Code plugin for discovering and safely managing
Claude-targeted AI Marketplace packages. It contributes the
`/ai-marketplace:manage-packages` skill and a self-contained Node 22 CLI; it does
not contribute hooks, MCP servers, or a dashboard of its own.

## Install

After its community listing is approved, install the public release with:

```text
/plugin marketplace add anthropics/claude-plugins-community
/plugin install ai-marketplace@claude-community
```

For repository development builds, add this repository as a Claude Code plugin marketplace, then install
`ai-marketplace@ai-marketplace` using Claude Code's plugin commands or
plugin manager. The repository marketplace is defined at
`.claude-plugin/marketplace.json`.

Restart or reload Claude Code if requested, then run:

```text
/ai-marketplace:manage-packages
```

Node.js 22 or newer is required. Marketplace-installed plugins are cached, so
the release archive includes the complete executable under
`bin/ai-marketplace.cjs` and has no runtime npm dependencies.

## Configuration and authentication

Non-secret preferences are stored in `~/.ai_marketplace/claude.json`. Workspace
and global installations share `.ai_marketplace/installed.json` state with the
other AI Marketplace interfaces. Operations coordinate through
`.ai_marketplace/.operation.lock`.

For private repositories, set the provider credential in the environment that launches Claude Code: `GH_TOKEN`/`GITHUB_TOKEN`, `AZURE_DEVOPS_ACCESS_TOKEN`/`AZURE_DEVOPS_EXT_PAT`, or `GITLAB_OAUTH_TOKEN`/`GITLAB_TOKEN`. Source-specific `AI_MARKETPLACE_*_<SOURCE>` overrides are also supported. Credentials are not accepted in plugin configuration or command arguments.

All mutations use an exact dry-run plan. Review its package identities, scope,
paths, executable effects, and destructive effects before confirming the
matching plan identifier. Package-provided lifecycle scripts run locally with
the current user's privileges and are not sandboxed.
