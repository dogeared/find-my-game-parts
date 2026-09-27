# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-09-27

### Added
- Semantic versioning, README badges, and a GitHub Actions CI workflow
  (lint, typecheck, tests, `snyk test`/`snyk code test`), plus automatic
  `vX.Y.Z` git tagging on version bumps landing on `main`.
- Self-registration on Keycloak's hosted login page — people can create
  their own accounts without any app-side changes, automatically styled
  by the existing custom theme.

### Changed
- Production Keycloak moved off Render entirely to a self-hosted instance
  (Cloudflare Tunnel), shared across projects via separate realms —
  Keycloak's JVM never fit comfortably in Render's starter plan even with
  clustering disabled and heap/metaspace tuned hard. `render.yaml` now
  only manages the app and its own database.

### Fixed
- Three separate bugs in the app's production Docker build, none of which
  had ever been exercised end-to-end before a real Render deploy surfaced
  them (a `husky` lifecycle script failing under `--omit=dev`, a missing
  `DATABASE_URL` placeholder needed only to satisfy `prisma generate`'s
  config lookup at build time, and a `COPY` referencing a `public/`
  directory that doesn't exist in this repo).

[0.2.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v0.2.0

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
