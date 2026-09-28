# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.4.0] - 2026-09-28

### Added
- Live BGG game search (`components/GameSearchField.tsx`), shared by the
  request form and the admin's add-game form — search-as-you-type is
  favored, with "use this title anyway" as an explicit freeform fallback
  for a slow/down API or a title BGG doesn't recognize. A choice only
  ever comes from a deliberate click (a real match or "use anyway"),
  never a bare keystroke.
- "Powered by BoardGameGeek" attribution on both search UIs, per BGG's
  API terms — placeholder pending the exact required logo asset/wording
  (BGG's terms/logo pages aren't reachable for automated verification;
  to be swapped in once confirmed).
- BGG id and a link to the game's BoardGameGeek page, shown next to the
  game title on both admin triage and the buyer's My Requests page —
  helps disambiguate similarly-titled games and gives quick access to
  the game's BGG listing. Only shown when a game has a real BGG match
  (not for manually-entered games).

### Fixed
- The admin's add-game form silently linked whatever title was typed to
  BGG's *first* search result with no confirmation — e.g. typing "this
  is a test" attached an unrelated game ("This Is Not a Test: Absolutely
  Dangerous..."). Reported live once the token made this reachable for
  the first time. Replaced with the same explicit-pick type-ahead used
  on the request form; a game is now only linked to a BGG id the admin
  actually clicked.
- A game picked from the public inventory list, or confirmed via "use
  this title anyway," would have silently failed to enable the submit
  button once BGG search was live — the validity check required a BGG
  match specifically (`bggId`) instead of any deliberate game choice.
  Caught before shipping by tracing through the flag flip live.
- BGG search results weren't decoding HTML/XML entities (e.g. `Catan:
  Traders &amp; Barbarians`, `Collector&#039;s Edition`) — invisible
  while the API returned nothing, confirmed live once real results
  started flowing through the real token.

### Security
- `bggId` was accepted from client-submitted request bodies (`POST
  /api/requests`, `POST /api/games`) with no validation, and could flow
  into an `<a href>` on admin triage / My Requests once the BGG-link
  display above was added — flagged by Snyk as a DOM XSS risk. Added
  `isValidBggId` (numeric-only) validation at both write boundaries and
  at the render sites, plus `encodeURIComponent` in the URL builder as
  defense in depth; verified live that injection attempts (e.g.
  `javascript:alert(1)`) are rejected with 400 while real BGG ids still
  work.

## [1.3.1] - 2026-09-28

### Changed
- Claim notification emails now send from `claim@findmygame.parts`
  instead of `noreply@findmygame.parts` — buyer replies land in a real
  inbox via Cloudflare Email Routing, and admin replies go out under the
  same address via the email provider's "send as" alias feature. No
  Mailjet-side configuration needed (any address on a verified domain
  works immediately).

### Added
- README: "Two-way claim email" section documenting the Cloudflare Email
  Routing setup, the email-provider "send as" alias steps, and the
  `EMAIL_FROM` app config.

## [1.3.0] - 2026-09-28

### Added
- "Send notification" button on every order in admin triage — lets the
  admin notify the buyer about what's decided so far at any point, on
  orders of any size, without waiting for every item to be resolved.
- Notifications now send automatically once every line item in an order
  has been decided (all available or not-available), instead of after
  every single item change — a multi-item order no longer spams the buyer
  with one email per decision.

### Changed
- Extracted the order-notification logic into `lib/notifications.ts`,
  shared by both the automatic full-triage send and the new manual button.

## [1.2.0] - 2026-09-28

### Changed
- Switched transactional email from Resend to Mailjet — the same provider
  Keycloak already sends through (SMTP) for this domain, so the whole
  project now relies on one email service instead of two. No change in
  behavior or content; only the sending mechanism changed.
- **Deploy note**: production's `RESEND_API_KEY` env var is replaced by
  `MJ_APIKEY_PUBLIC` and `MJ_APIKEY_PRIVATE` — these must be set on Render
  before this version deploys, or notification emails will silently stop
  sending (logged, not fatal) until they are.

## [1.1.0] - 2026-09-28

### Added
- "My Requests" page — signed-in users can see their own orders, each
  line item's current status, and when it was last updated, instead of
  relying solely on email.
- Available line items now show their claim-by deadline (5 days from
  approval) on both the request confirmation flow and My Requests.

### Changed
- Admin triage no longer uses `window.prompt()` for price/quantity —
  they're now inline fields on each pending line item, so marking an item
  available with a reduced quantity is one action instead of two prompts.
- Admin-entered price for an available line item is now treated as
  per-item, not a flat total. Anywhere a price shows (admin triage, My
  Requests, notification email) now displays "$X each — $Y total" when
  quantity is greater than 1 (e.g. $2 each on 5 available shows as
  "$2.00 each — $10.00 total").

## [1.0.0] - 2026-09-28

### Added
- Bundled part requests: a single submission for one game can now carry
  multiple line items (e.g. a unique card + a stack of meeples) instead of
  one request per part.
- Admins triage each line item independently — mark it available or not,
  and adjust the fulfilled quantity down from what was requested (e.g. 5 of
  10 meeples in stock).
- Global footer with a link to the GitHub repo, the current version, and a
  "made with ❤️ by dogeared" tagline.

### Changed
- **Breaking data model change**: `PartRequest` is now a line item under a
  new `PartOrder` (game + requester + submission time). Every existing
  request is migrated automatically into its own one-item order — no data
  is lost.
- Buyer notification emails now summarize the whole order's outcome in one
  message instead of sending one email per part.
- Moved request triage off its own nav link (`/admin/requests`) and into a
  "Requests" tab on the admin page, alongside Inventory and About.

## [0.5.1] - 2026-09-28

### Added
- `LICENSE` (MIT) — the project is now open source.
- "Home" link in the nav.

### Changed
- The signed-in user's name now shows first in the nav (upper-left),
  ahead of Home/About/admin links/sign-out.
- Added a proper border and margin to the About tab's preview box,
  which was missing both.

[1.4.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v1.4.0
[1.3.1]: https://github.com/dogeared/find-my-game-parts/releases/tag/v1.3.1
[1.3.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v1.3.0
[1.2.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v1.2.0
[1.1.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v1.1.0
[1.0.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v1.0.0
[0.5.1]: https://github.com/dogeared/find-my-game-parts/releases/tag/v0.5.1

## [0.5.0] - 2026-09-28

### Added
- Public `/about` page — content lives in a new `AboutPage` DB row, not
  a file, so an admin can update it without a redeploy.
- Admin page is now tabbed: **Inventory** (unchanged) and **About**, a
  markdown textarea with a **Preview** button that renders through the
  same component the public page uses.

### Changed
- Nav "Inventory" button is now "Admin" (`/admin`, was `/admin/games`),
  reflecting that it now hosts more than just inventory management.

[0.5.0]: https://github.com/dogeared/find-my-game-parts/releases/tag/v0.5.0

## [0.4.3] - 2026-09-27

### Changed
- Nav "Sign in" button now reads "Sign in / Sign up", making
  self-registration discoverable from the button itself.
- Keycloak's "New user? Register" link is now styled as a full-width
  secondary button underneath the Sign In button, matching the login
  theme's existing button language, instead of a plain text link.

[0.4.3]: https://github.com/dogeared/find-my-game-parts/releases/tag/v0.4.3

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
