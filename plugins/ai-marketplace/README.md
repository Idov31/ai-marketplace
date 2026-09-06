# AI Marketplace for Codex

## Install and update

Install **AI Marketplace** from the OpenAI Plugins Directory in Codex. Codex
receives reviewed releases through OpenAI's native plugin distribution.

For repository development builds only:

```powershell
codex plugin marketplace add Idov31/ai-marketplace --ref master
codex plugin add ai-marketplace@ai-marketplace-dev
```

Refresh and reinstall a development build with:

```powershell
codex plugin marketplace upgrade ai-marketplace-dev
codex plugin add ai-marketplace@ai-marketplace-dev
```

The tracked `.agents/plugins/marketplace.json` keeps the marketplace source aligned with `plugins/ai-marketplace` on the selected Git revision.

This skills-only Codex plugin provides a local AI Marketplace dashboard plus conversational access to the shared marketplace engine. It manages Codex packages in the active workspace or the user's global Codex directories.

Ask Codex to **Open AI Marketplace**. The skill starts or reuses a server bound
only to `127.0.0.1` and opens it in the Codex in-app Browser. The dashboard offers
Available, Installed, and Auto Updates views, filters and details, package and
bulk lifecycle actions, group/sync configuration, diagnostics, and progress.
Installed packages remain visible when a catalog refresh is offline.

Codex does not currently expose a public plugin contribution point for an
arbitrary native sidebar tab. The in-app Browser tab is therefore the supported
local visual surface; the CLI remains the fallback. The server is workspace-
scoped, reuses an existing live instance, and stops after thirty idle minutes.

The plugin never stores credentials. GitHub uses `GH_TOKEN` or `GITHUB_TOKEN`; Azure DevOps uses `AZURE_DEVOPS_ACCESS_TOKEN` or `AZURE_DEVOPS_EXT_PAT`; GitLab uses `GITLAB_OAUTH_TOKEN` or `GITLAB_TOKEN`. Source-specific variants use the documented `AI_MARKETPLACE_<PROVIDER>_<KIND>_<SOURCE>` names. OAuth values are externally acquired bearer tokens; the plugin does not perform sign-in or refresh.

Every dashboard and CLI mutation is planned first. The exact source-qualified
packages, scope, paths, skipped/ineligible items, and destructive effects are
shown before an explicit confirmation; expired or stale plans are rejected.

MCP packages require root-level `install.py` and `uninstall.py` files. Reviewed
plans show these executable effects before apply. Scripts run without a shell,
receive `--action` and `--platform` arguments, time out after ten minutes, and
use a cached package payload so uninstall remains available offline. Package
scripts run with the current user's privileges and are not sandboxed.

The dashboard has no external scripts or hosted dependency. Bootstrap uses a
one-time URL fragment and a local secure session cookie; do not share bootstrap
URLs. Use `dashboard status` or `dashboard stop` through the bundled CLI for
lifecycle control.
