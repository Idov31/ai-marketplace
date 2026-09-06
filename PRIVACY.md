# AI Marketplace Privacy Policy

Effective date: September 4, 2026

AI Marketplace browses package metadata from GitHub, Azure DevOps, and GitLab repositories selected by
the user and installs selected package files into the user's workspace or user
directory. The software runs locally. Idov31 does not operate a marketplace
backend for this plugin and does not receive telemetry, package selections,
repository contents, workspace contents, or provider credentials from it.

## Data processed locally

AI Marketplace may process:

- configured repository URLs, branches, providers, and package folders;
- package manifests and files returned by repository-provider APIs;
- local installation metadata in `.ai_marketplace/installed.json`;
- local Codex plugin configuration in `~/.ai_marketplace/codex.json`; and
- optional GitHub, Azure DevOps, or GitLab credentials supplied through VS Code
  secret storage or documented environment variables.

Credentials are used only to authenticate repository API requests. They are not written
to marketplace configuration or installation state and must not appear in
normal command output or logs.

## Third-party services

Repository requests are governed by the selected provider's terms and privacy policy. Packages
come from repositories configured by the user. Their publishers control those
package contents and may impose separate terms. Users should review and trust
a repository before installing its packages.

## Local changes and deletion

Installation changes are made only after a user-requested action or a user-enabled
automatic package policy. Package-provided MCP lifecycle scripts may run locally
with the user's privileges after their effects are disclosed. Interactive plugin
interfaces preview mutations before applying them. Users can uninstall managed
packages and remove local marketplace configuration or state files at any time.

## Contact

For privacy questions, open an issue in the AI Marketplace GitHub repository:
https://github.com/Idov31/ai-marketplace/issues
