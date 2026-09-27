# TODOS

## Find My Game Parts

### Wire up the approved BGG API token

**What:** Once BGG approves the application (submitted 2026-09-27), add `BGG_API_TOKEN` to `.env`/`docker-compose.yml`, send it as `Authorization: Bearer <token>` in `lib/bgg.ts`'s `fetch` call, and flip `REQUIRE_BGG_MATCH` back to `true` in `app/request/page.tsx`.

**Why:** BGG's XML API has required a registered, approved token since July 2, 2025 — anonymous requests get a flat 401. Confirmed live during implementation; `bgg.ts` currently returns an empty result for every search, so the request form's "require a valid game" gate was relaxed to accept the manual-fallback path too, not just a real BGG match.

**Context:** See the Dependencies section of `docs/designs/find-my-game-parts.md` for the full story. This is a 3-part change (add the header, re-enable the frontend gate, remove this TODO) — do all three together so the gate and the actual API capability stay in sync.

**Effort:** S
**Priority:** P1
**Depends on:** BGG approving the application (external, out of our control — typically 1-2 business days per other developers' reports)

### Keycloak monitoring / break-glass admin path

**What:** Add basic uptime monitoring for the self-hosted Keycloak instance, plus a break-glass way for the founder to access the admin panel (toggle inventory, triage requests) if Keycloak is down.

**Why:** Keycloak gates both buyer auth and the founder's own admin panel. If it goes down, only public browse keeps working — the founder can't even manage inventory during the outage.

**Context:** Flagged during `/plan-eng-review` (find-my-game-parts design doc, Open Questions) as an unresolved single point of failure. Not urgent at MVP request volume, but should be resolved before real money/inventory depends on this daily.

**Effort:** S
**Priority:** P3
**Depends on:** Keycloak setup (Dependencies in the design doc)

### PII-safe public read model

**What:** Ensure the public browse endpoint (games in inventory) is served from a data path that structurally cannot include PartRequest rows or requester emails — not just "don't render it in the UI."

**Why:** Public browsing is unauthenticated by design. A future ORM/serializer change could accidentally leak requester PII through that same endpoint if it isn't structurally isolated from request data.

**Context:** Flagged during `/plan-eng-review` as a stated requirement without an implementation approach yet. Resolve when the data model is actually built — e.g. a dedicated public read query/view that only ever touches the Game table.

**Effort:** S
**Priority:** P2
**Depends on:** None

### BGG lookup rate-limit caching

**What:** Add a basic debounce on the search-as-you-type BGG lookup, plus light caching of common lookups.

**Why:** The BoardGameGeek API has rate limits; the request form's live search could hit them under real traffic. Low risk at MVP scale (single-digit requests/day), but cheap to add before it matters.

**Context:** Flagged during `/plan-eng-review` Performance review. Not urgent — revisit once request volume grows past what one hobbyist-scale audience generates.

**Effort:** S
**Priority:** P4
**Depends on:** BGG API integration (bgg.ts helper)

### V2: founder-side quantity tracking + "not available" cache

**What:** Add real stock-quantity tracking per part and a cache of "already confirmed not available" parts, replacing the MVP's fully-manual physical-inventory check per request.

**Why:** The MVP deliberately defers this — manual checking works at low request volume but becomes a bottleneck as volume grows.

**Context:** Already named in the design doc's Open Questions as "deferred until manual physical-inventory rechecking becomes a bottleneck." This TODO exists so it isn't only living in prose — pick it up once request/fulfillment volume makes manual rechecking painful.

**Effort:** M
**Priority:** P4
**Depends on:** The concierge MVP actually shipping and generating real request volume
