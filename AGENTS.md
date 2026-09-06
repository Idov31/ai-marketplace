# AI Marketplace Agent Guide

## Project Overview

AI Marketplace is a TypeScript VS Code extension that browses AI Marketplace packages from GitHub, Azure DevOps, or GitLab repositories and installs them into the current workspace, user directory, or cloud state for Codex, Cursor, GitHub Copilot, or Claude.

Use the term `package` throughout this codebase. Do not reintroduce old `artifact` terminology, compatibility aliases, settings, command IDs, filenames, or docs.

The extension:
- Reads configuration from `aiMarketplace.*` VS Code settings.
- Stores optional GitHub tokens in VS Code `ExtensionContext.secrets`.
- Lists versioned package-local `ai_marketplace.yaml` manifests from GitHub, Azure DevOps, and GitLab APIs.
- Shows packages in a marketplace-like webview and sidebar view.
- Installs, updates, uninstalls, hotloads, and offloads packages.
- Tracks workspace install state in `.ai_marketplace/installed.json`.

## Package Model

Marketplace package folders use a strict, grouped, versioned `ai_marketplace.yaml` manifest. The former marketplace manifest formats are unsupported.

Supported package types are defined in `src/types/packages.ts`:
- `skill`
- `command`
- `mcp`
- `agent`
- `hook`
- `rule`

Supported install platforms:
- `codex`
- `cursor`
- `github-copilot`
- `claude`

Supported delivery targets:
- `workspace`
- `global`
- `cloud`

Important behavior:
- Hotload/offload is user-controlled and stored as metadata.
- Catalog and installed identities are source-qualified; package source and group are preserved in state and shown in the UI.
- A non-empty `aiMarketplace.repositories` list replaces the legacy single-repository source.
- Per-source tokens are fallback credentials used only after shared-token 401/403 responses.
- Workspace installs use the current repository root; global installs use the user home directory with the same platform folder layout.
- Preferred install order is Codex, then Cursor, GitHub Copilot, and Claude, unless the configured default platform is supported.
- Hotload/offload moves local package folders between active paths and `.offload/<platform>/<type>/<package-id>`.
- GitHub Copilot workspace installs use `.github/<type>/<package-id>` package roots such as `.github/skills`, `.github/agents`, and `.github/hooks`.
- MCP packages always configure the selected platform's user-level MCP config instead of copying package folders: `~/.codex/config.toml`, `~/.cursor/mcp.json`, `~/.copilot/mcp-config.json`, or `~/.claude.json`.
- `openai.yaml` package resources are copied only for Codex installs and updates.
- Cloud delivery is currently supported only for agent packages and records install state without writing package files.
- Packages with `installation.default: true` are installed automatically to the global/user directory when a catalog refresh detects they are not installed anywhere.
- Claude commands, agents, and rules install as flat Markdown files; Claude hooks manage exact contributions in `.claude/settings.json`.
- Codex agent packages must use `<package-id>.toml` as their entrypoint. The package directory remains at `.codex/agents/<package-id>` for companion resources, while a Marketplace-owned copy of the entrypoint is materialized at `.codex/agents/<package-id>.toml` for Codex discovery. Ownership and content hashes must be verified before update, offload, or uninstall removes or replaces that discovery file.
- Hook packages support Codex, GitHub Copilot, and Claude.
- Rule packages can target Codex, Cursor, GitHub Copilot, Claude, or any combination of those platforms.
- Updates replace managed package files from source metadata; they do not merge local edits.

## Monorepo Layout and Key Files

- `packages/marketplace-core/src/`: host-neutral catalog, parsing, planning, state, and lifecycle logic. It must not import VS Code, UI, or direct filesystem APIs.
- `packages/vscode-plugin/src/extension.ts`: extension activation, command registration, refresh flow, action orchestration, and auto-update toggle.
- `packages/vscode-plugin/src/services/`: VS Code configuration, storage, secrets, and host adapters.
- `packages/vscode-plugin/src/ui/marketplaceWebview.ts`: CSP-protected webview UI and message handling.
- `packages/vscode-plugin/package.json`: extension contributions, settings, commands, and VSIX metadata.
- `plugins/ai-marketplace/`: Codex plugin manifest, skill, bundled CLI, Node storage adapter, and plugin-local tests.
- `package.json`: workspace orchestration scripts.
- `README.md`: user-facing configuration, build, and deployment docs.
- `.github/workflows/`: GitHub Actions CI and VSIX packaging workflows.
- `test/`: unit tests for parsing, validation, path planning, install planning, and versioning.

## Development Commands

Use Windows command forms in this workspace:

```powershell
npm.cmd install
npm.cmd run compile
npm.cmd test
npm.cmd run lint
npm.cmd run watch
```

Run `npm.cmd run package:vscode` or `npm.cmd run package:codex` for one interface, and `npm.cmd run package` for both artifacts.

Run/debug the extension with VS Code's `Run Extension` launch config. Do not run `out/extension.js` directly with Node; the `vscode` module is only available in the extension host.

Before finishing code changes, run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run compile
```

## Coding Conventions

- Keep TypeScript strict, explicit, and readable.
- Prefer small services with clear responsibilities over large cross-cutting changes.
- Preserve existing module boundaries and naming style.
- Use `pkg` as a local variable name for packages.
- Keep command IDs and settings package-based, for example `aiMarketplace.installPackage` and `aiMarketplace.packageFolders`.
- Do not log tokens or authorization headers. Redact sensitive diagnostics.
- Use VS Code `workspace.fs` APIs for extension file operations.
- Keep webview messages validated and narrow.
- Keep webview CSP strict, use nonced scripts, and use VS Code theme tokens.
- Prefer ASCII in source and docs unless there is a specific reason otherwise.

## Security Rules

Package contents are external repository data. Treat them as untrusted:

- Reject absolute paths.
- Reject `..` traversal.
- Reject unsafe symlinks or paths that escape the workspace.
- Validate manifest shape and supported values before using data.
- Fetch manifests first; fetch package folder contents only for install/update.
- Never expose tokens in logs, errors, webviews, or test fixtures.

When editing path or installer logic, add or update tests for traversal, malformed manifests, and workspace escape cases.

## UI Notes

The extension contributes an AI Marketplace activity bar container and a webview view.

When changing the UI:
- Keep it close to VS Code Marketplace conventions.
- Use accessible controls and labels.
- Keep buttons and message commands aligned with package actions.
- Show update availability above other packages.
- Maintain the Installed tab behavior.
- Preserve the global Auto update toggle behavior: enabling it applies updates immediately, and refresh applies updates when it is enabled.
- Preserve Installed tab offline behavior: local workspace/global installed state must render even when GitHub catalog refresh fails.
- Keep hotload/offload available offline for local installs.

## Testing Guidance

Existing tests are Node unit tests compiled to `out-test`.

Add focused tests when changing:
- Manifest validation.
- Multi-repository normalization, partial failures, token fallback, source provenance, and collisions.
- Prologue hotload parsing.
- Package type support.
- Install/offload/hotload/uninstall planning.
- Version comparison and update availability.
- Path safety and workspace escape prevention.
- GitHub repository URL parsing.
- Default package auto-install planning.

Use mocked/planned filesystem behavior for service-level logic when possible. Avoid tests that require real GitHub credentials.

## Deployment Notes

The packaged extension should include:
- `packages/vscode-plugin/out/`
- `packages/vscode-plugin/media/`
- `packages/vscode-plugin/package.json`
- `packages/vscode-plugin/README.md`
- `packages/vscode-plugin/CHANGELOG.md`

Generated development folders such as `node_modules/`, `src/`, `test/`, and `out-test/` are excluded by `.vscodeignore`.

VS Code can install the VSIX. Updating is done by installing a newer VSIX over the current extension with `--force`.
After an installed extension updates to a different version, activation should open the packaged `CHANGELOG.md` once using VS Code's Markdown preview.
