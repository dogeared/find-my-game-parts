# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-26

Initial concierge MVP release.

### Added
- Request form for sourcing replacement board game parts, with server-side validation.
- Keycloak-backed authentication (NextAuth), including Google/Facebook federation support.
- Admin triage flow for incoming part requests, with Keycloak groups as the source of truth for admin access.
- Game inventory management for admins.
- Configurable light/dark/high-contrast themes and an accessibility toggle.
- Custom Keycloak login theme matching the app's visual style, with an idempotent realm-bootstrap script.
- Security hardening: per-endpoint rate limiting, nonce-based Content-Security-Policy, standard security headers, input validation.
- Snyk `test` and `code test` run as a pre-push git hook.
- Render blueprint (`render.yaml`) and a production-ready Keycloak Docker image for deployment.

[0.1.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v0.1.0
