# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com),
and this project adheres to [Semantic Versioning](https://semver.org).

## [0.3.4] - 2026-05-02

### Fixed

- use latest Node in release workflow -- trusted publishing requires npm 11.5.1+ (Node 22 ships npm 10)

## [0.3.3] - 2026-05-02 [YANKED]

Failed to publish -- npm 10 doesn't support trusted publishing OIDC flow.

## [0.3.2] - 2026-05-02 [YANKED]

Failed to publish -- `NPM_TOKEN` triggers 2FA OTP requirement.

## [0.3.1] - 2026-05-02 [YANKED]

Failed to publish -- OIDC-only auth returns 404 for scoped packages.

## [0.3.0] - 2026-05-02 [YANKED]

Failed to publish -- release workflow referenced a missing `NPM_TOKEN` secret.

### Added

- `pl_setup` tool -- guided two-step API key configuration; key never leaves the browser
- `pl_export` tool -- returns a script to export all ProjectionLab data via the Plugin API
- `pl_snapshot` tool -- save export data as a local JSON file with automatic API key redaction
- `pl_list_snapshots` tool -- list saved snapshots sorted by date
- `pl_restore` tool -- generate scripts to restore plans and current finances from a snapshot
- `projectionlab://knowledge` resource -- curated FIRE concepts, withdrawal strategies, and ProjectionLab help links
- FIRE advisor knowledge base embedded in server instructions
- CI workflow (build on PRs and pushes to main)
- release workflow (npm publish with provenance on release commits)
- README, LICENSE (MIT), CHANGELOG

### Fixed

- release workflow trigger -- use `startsWith` instead of `contains` to avoid accidental publishes

## [0.2.0] - 2026-05-02

Accidental first publish triggered by the release workflow matching "release" in a commit message. Same code as 0.3.0 minus the workflow fix and documentation updates.
