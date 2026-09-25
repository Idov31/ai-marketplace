# AI Marketplace

AI Marketplace discovers, installs, updates, migrates, hotloads, offloads, and removes versioned AI packages from GitHub, Azure DevOps, and GitLab repositories.

## Supported AI vendors

Packages can target these AI vendors:

| Vendor | Package location / configuration |
| --- | --- |
| Codex | `.codex/` and `~/.codex/` |
| Cursor | `.cursor/` and `~/.cursor/` |
| GitHub Copilot | `.github/` and `~/.copilot/` |
| Claude Code | `.claude/` and `~/.claude.json` |
| DeepSeek Harness | `.dsh/` skills and rules, plus selected profile bundles |

## Supported package types

| Type | What it packages |
| --- | --- |
| `skill` | Reusable instructions and resources for an AI workflow. |
| `mcp` | An MCP server configuration for the selected vendor's user-level MCP settings. |
| `hook` | Lifecycle automation for supported AI vendors. |
| `command` | A reusable command that a supported AI vendor can expose. |
| `agent` | A specialized agent definition; cloud delivery is available only for this type. |
| `rule` | Persistent instructions or coding rules for one or more AI vendors. |

## Supported platforms

| Platform | Purpose |
| --- | --- |
| VS Code extension | Full marketplace interface for Codex, Cursor, GitHub Copilot, Claude Code, and DeepSeek Harness packages. |
| Cursor | Runs the VS Code extension. |
| Codex plugin | Dashboard and guided CLI for Codex packages. |
| Claude Code plugin | Guided CLI skill for Claude Code packages. |
| DeepSeek Harness bundle | Native right Sidebar page and authenticated Host API for Harness packages. |

The Codex and Claude plugins each manage only their own vendor's packages. VS Code and Cursor use the same extension.

### DeepSeek Harness packages

The integration targets DeepSeek Harness `0.1.5-rc.3`. Select a named profile in `aiMarketplace.deepseekHarnessProfile` in VS Code. The extension finds a matching local `npx` installation automatically; `aiMarketplace.deepseekHarnessCliPath` can point to `dsh` or its `lib/bin.js` when installed elsewhere. Set `DSH_HOME` before launching VS Code if Harness uses a custom home.

Harness skills use `SKILL.md` under workspace `.dsh/skills/<id>/` or `$DSH_HOME/skills/<id>/`. Rules use `RULE.md` under `.dsh/rules/<id>/` and a Marketplace-owned profile adapter that reads only active rules assigned to that profile. It leaves `AGENTS.md` untouched. Commands, MCP, agents, and hooks use global delivery through `dsh plugin --profile <name> add`; each package must ship a prebuilt Harness `package.json`, `cordis.patch.yml`, and its referenced modules. The installer does not translate another vendor's format. Harness cloud delivery is unsupported.

For a native Harness page, build with `npm.cmd run build:harness`, then add [the Harness bundle](plugins/ai-marketplace-harness/README.md) to the selected profile. The Marketplace page appears in the Web UI right Sidebar guide. Repository sources for that page are configured in `~/.ai_marketplace/deepseek-harness.json`; credentials come from the same provider environment variables as the Codex and Claude CLIs.

## Repository layout

```text
packages/
  marketplace-core/       Shared catalog, validation, planning, and lifecycle engine
  marketplace-node-cli/   Shared CLI, storage, locking, and host adapters
  vscode-plugin/          VS Code and Cursor extension
plugins/
  ai-marketplace/         Codex plugin
  ai-marketplace-claude/  Claude Code plugin
schemas/                  Generated package-manifest JSON Schema
```

All interfaces coordinate package state through `.ai_marketplace/installed.json` and `.ai_marketplace/.operation.lock`.

## Setup and installation

### Prerequisites

- Node.js 22 or newer
- A supported Git provider: GitHub, Azure DevOps, or GitLab
- A provider credential only when browsing private repositories, supplied through your host's secret storage or environment

### Develop locally

```powershell
npm.cmd install
npm.cmd test
npm.cmd run lint
npm.cmd run compile
```

Use VS Code's **Run Extension** launch configuration to debug the VS Code extension. Do not run `out/extension.js` directly.

### Install in VS Code or Cursor

After the first public release:

- VS Code: install `Idov31.ai-marketplace` from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Idov31.ai-marketplace).
- Cursor: install the same extension from [Open VSX](https://open-vsx.org/extension/Idov31/ai-marketplace) through Cursor's Extensions view.

VS Code and Cursor use their native extension update mechanisms. For local development, build `dist/ai-marketplace-<version>.vsix` with `npm.cmd run package:vscode` and use **Extensions: Install from VSIX...**.

### Install the Codex plugin

After its listing is approved, install **AI Marketplace** from the OpenAI Plugins Directory in Codex. Public directory releases are reviewed and published through the OpenAI Platform.

For repository development builds only:

```powershell
codex plugin marketplace add Idov31/ai-marketplace --ref master
codex plugin add ai-marketplace@ai-marketplace-dev
```

Then ask Codex to **Open AI Marketplace**. The plugin starts a workspace-local dashboard in Codex's in-app browser. See the [Codex plugin guide](plugins/ai-marketplace/README.md) for updates and CLI details.

### Install the Claude Code plugin

After its community listing is approved, install it with:

```text
/plugin marketplace add anthropics/claude-plugins-community
/plugin install ai-marketplace@claude-community
```

For repository development builds, use:

```text
/plugin marketplace add Idov31/ai-marketplace
/plugin install ai-marketplace@ai-marketplace
/ai-marketplace:manage-packages
```

See the [Claude Code plugin guide](plugins/ai-marketplace-claude/README.md) for its CLI workflow.

## Configure package repositories

New installs start with no configured package repository. Add one from the VS Code Marketplace **Configuration** tab or configure `aiMarketplace.repositories` directly.

In VS Code or Cursor, configure `aiMarketplace.repositories`:

```json
{
  "aiMarketplace.repositories": [
    {
      "id": "company-packages",
      "url": "https://github.com/example/ai-packages",
      "branch": "main"
    },
    {
      "id": "azure-packages",
      "url": "https://dev.azure.com/example/research/_git/ai-packages"
    },
    {
      "id": "private-gitlab",
      "provider": "gitlab",
      "url": "https://gitlab.example.com:8443/research/ai-packages"
    }
  ],
  "aiMarketplace.defaultPlatform": "codex"
}
```

Each source needs a unique `id` and a GitHub, Azure DevOps, or GitLab URL. GitHub also accepts `owner/repo`. For private sources, use **AI Marketplace: Set Repository Credential** in VS Code/Cursor. The Codex and Claude plugins read provider credentials from environment variables such as `GH_TOKEN`, `AZURE_DEVOPS_ACCESS_TOKEN`, and `GITLAB_TOKEN`.

The VS Code Marketplace **Configuration** tab can add, edit, and remove these repositories. It saves the list in User Settings, removes older workspace overrides on save, and treats an explicitly empty list as no catalog sources. The same tab stores package auto-update and automatic-group preferences as application-scoped User Settings; legacy values in `.ai_marketplace/installed.json` are discarded.

## Package manifest

Every package folder must contain `ai_marketplace.yaml`. Only this canonical, grouped manifest format is supported.

```yaml
schema_version: 1
minimum_reader_schema_version: 1

package:
  name: "@research/example-skill"
  type: skill
  version: "1.0.0"
  description: Reusable guidance for an AI workflow.
  entrypoint: SKILL.md

targets:
  platforms: [codex, cursor, github-copilot, claude]
  delivery: [workspace, global]

metadata:
  tags: [research, workflow]
```

See the generated [manifest schema](schemas/ai_marketplace.schema.json) for every supported field. Package contents are untrusted: paths, YAML structure, and manifest values are validated before installation.

## Build packages

```powershell
npm.cmd run package:vscode
npm.cmd run package:codex
npm.cmd run package:claude
npm.cmd run package
```

The last command creates all distributable artifacts.
