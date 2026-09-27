# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.2] - 2026-09-27

### Fixed
- Keycloak's post-email-verification page ("Your email address has been
  verified.") had no link or way to continue — `setup-realm.sh` now sets
  the client's `baseUrl` (Keycloak's "Home URL" field), which Keycloak's
  own default template falls back to for a "Back to Application" link.

[0.4.2]: https://github.com/dogeared/find-my-game-parts/releases/tag/v0.4.2

## [0.4.1] - 2026-09-27

### Changed
- Temporarily removed the Snyk job from CI — `snyk code test` hung
  indefinitely more than once (quota exhaustion, then an org-level Snyk
  Code enablement gap), and even with per-step timeouts as a backstop
  the timing is still unreliable enough to pull out of required checks
  for now. Still enforced locally via the `.husky/pre-push` hook; will
  be re-added once confirmed stable.

[0.4.1]: https://github.com/dogeared/find-my-game-parts/releases/tag/v0.4.1

## [0.4.0] - 2026-09-27

### Added
- Optional email verification for new accounts, via Keycloak's realm-level
  SMTP configuration (any standard SMTP relay, e.g. Mailjet's free tier).
  Entirely Keycloak-hosted — no app code changes. Skipped by default in
  local dev (no real email account needed) unless `SMTP_HOST` is set.

### Changed
- CI's Snyk job now has explicit timeouts (5 minutes per `snyk`
  command, 15-minute job backstop) after `snyk test` hung indefinitely
  in a real run and had to be cancelled by hand.

[0.4.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v0.4.0

## [0.3.0] - 2026-09-27

### Fixed
- Production Docker build: `prisma.config.ts` was never copied into the
  image, so `prisma migrate deploy` couldn't resolve `datasource.url` and
  every page hitting the database 500'd ("table public.Game does not
  exist") on the first real deploy. `render.yaml`'s `preDeployCommand`
  now runs migrations automatically before every deploy, via a
  version-pinned ephemeral `npx` invocation that never touches the
  production dependency tree (keeps Snyk-flagged transitive
  vulnerabilities in `prisma`'s own dependencies out of scope).
- Keycloak multi-domain hostname resolution: a fixed `KC_HOSTNAME`
  alongside `hostname-strict=false` caused Keycloak's own generated
  links (e.g. `login-actions/authenticate`) to fall back to a different
  realm's hostname mid-flow, breaking the session cookie across origins.
  Removing the fixed hostname entirely (`proxy-headers=xforwarded`,
  confirmed via Keycloak's own hostname-debug page to match what
  Cloudflare Tunnel actually sends) fixed it for both realms.
- Keycloak client authentication: switched to a public client
  (Authorization Code + PKCE, no client secret) to match how the
  self-hosted instance's client was actually configured — the app was
  still sending `client_secret_basic`, failing every login.
- Keycloak login theme now actually applies on the self-hosted instance
  (files were never deployed there before) and the group-membership
  protocol mapper is in place, so Keycloak-group-based admin status
  works correctly end-to-end in production.

[0.3.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v0.3.0

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
