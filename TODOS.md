# TODOS

## Find My Game Parts

### Notification log

**What:** Add a way for an admin to review notification emails that have already been sent — at minimum, per order/item: recipient, timestamp, and whether it succeeded, surfaced somewhere in the admin UI.

**Why:** Now that notifications can fire two ways (automatically once an order is fully triaged, or manually via the "Send notification" button — see `lib/notifications.ts`), the admin has no way to check afterward what was actually sent or whether a send failed. Right now failures only go to server logs (`console.error` in `app/api/admin/requests/[id]/route.ts` and the notify route), which an admin can't see.

**Context:** Named directly by the founder when the manual/automatic notification split was built. Likely needs a small `NotificationLog` model (orderId, sentAt, sentTo, succeeded) written to from `lib/notifications.ts`'s `notifyOrder`, plus a read-only view in the admin page.

**Effort:** S
**Priority:** P3
**Depends on:** None

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
