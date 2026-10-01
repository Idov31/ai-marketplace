# AI Marketplace for Visual Studio

## 1.1.0

- Routed routine catalog progress and loaded-package messages to the AI Marketplace
  Output pane; only actionable catalog warnings appear in the dashboard banner.

- Added a visible native repository-authentication toolbar action with provider-
  specific PAT/OAuth choices, configured repository targets, secure save/removal,
  and catalog refresh after credentials change.
- Recreated parent-bound WebView2 instances after docking or reattachment, canceled
  stale initialization, and added native reload and browser-failure recovery.

- Fixed the bundled marketplace logo path and explicit provider validation when
  adding repositories. Renamed repository actions and removed the default-package
  checkbox; repository-designated default installs are disabled in Visual Studio.

- Removed the implicit repository fallback for Visual Studio; configure repository
  URLs and branches under Auto Updates > Marketplace sources. Diagnostics now
  explain an empty configuration.

- Fixed WebView2 disposal while hiding or docking the marketplace tool window,
  and issued fresh authenticated launch URLs when reconnecting to the sidecar.
- Fixed package loading by registering the installed assembly path and bundling
  private managed dependencies. Packaging now validates the finished VSIX.
- Added Visual Studio 2022 package browsing and lifecycle management for Codex,
  Cursor, GitHub Copilot, and Claude through a verified bundled sidecar.
- Added Visual Studio-local configuration, Windows Credential Manager-backed
  repository credentials, diagnostics, and offline installed-state access.
