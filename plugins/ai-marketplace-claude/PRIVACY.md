# AI Marketplace Privacy Policy

Effective date: September 4, 2026

AI Marketplace runs locally. It reads package metadata and files from GitHub, Azure DevOps, and GitLab
repositories selected by the user and writes only approved package,
configuration, and installation-state changes. Idov31 operates no marketplace
backend and receives no telemetry, workspace contents, package selections, or
credentials from this plugin.

The plugin may process repository settings, package manifests and files, local
installation metadata, `~/.ai_marketplace/claude.json`, and optional provider credentials from documented environment variables. Credentials are used only for repository requests and are
not written to configuration, state, normal output, or logs.

Repository providers and package publishers apply their own terms and privacy policies. Users
should review and trust repositories before installing their packages. Managed
packages can be uninstalled and local marketplace configuration or state can be
removed by the user.

Package-provided MCP lifecycle scripts may run locally with the user's
privileges after their effects are disclosed and approved.

Questions: https://github.com/Idov31/ai-marketplace/issues
