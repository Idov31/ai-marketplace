# AI Marketplace for DeepSeek Harness

This bundle targets `@deepseek-ai/dsh` version `0.1.5-rc.3`. It provides a Marketplace tab in the Web UI right Sidebar and an authenticated Host API. The native page uses the shared AI Marketplace catalog and lifecycle core and keeps the Installed view available when catalog refresh fails.

Build from the repository root:

```powershell
npm.cmd run build:harness
npx.cmd @deepseek-ai/dsh@0.1.5-rc.3 plugin --profile web add ./plugins/ai-marketplace-harness
npx.cmd @deepseek-ai/dsh@0.1.5-rc.3 web
```

In the Web UI, open the right Sidebar guide and select **AI Marketplace**. The profile selector lists profiles under `$DSH_HOME/profiles`; bundle actions apply to the selected profile.

Configure repository sources in `~/.ai_marketplace/deepseek-harness.json`:

```json
{
  "schemaVersion": 1,
  "repositories": [
    {
      "id": "team",
      "url": "https://github.com/example/marketplace",
      "branch": "main",
      "enabled": true
    }
  ]
}
```

For private sources, set the appropriate provider credential environment variable before starting Harness, such as `GH_TOKEN`, `GITLAB_TOKEN`, or `AZURE_DEVOPS_ACCESS_TOKEN`. Installed state is stored under `~/.ai_marketplace/installed.json` for global packages and `<workspace>/.ai_marketplace/installed.json` for workspace packages. The native page uses the selected Harness session's working directory for workspace packages.

Harness bundles for command, MCP, agent, and hook packages need a root `package.json` entrypoint with a matching version, `dsh.bundle.patch` pointing at `cordis.patch.yml`, a patch inserting the package's plugin, and every referenced module already built. A bundle cannot use install lifecycle scripts. Skills use `SKILL.md`; rules use `RULE.md`. Cloud delivery is unsupported.
