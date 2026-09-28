// Dependency-free shared constants — safe to import from both server code
// (lib/claims.ts) and client components (app/my-requests/page.tsx). Do not
// add imports here; anything with server-only dependencies (e.g. Prisma)
// would get bundled into client code that imports this file.

// 5-day claim window (outside-voice finding #5, plan-eng-review): if the
// earliest requester for a scarce/unique part doesn't confirm and pay
// within 5 days of being notified, the claim passes to the next-earliest
// pending request for that same game.
export const CLAIM_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

// BGG approved this app's API token 2026-09-28 (bgg.ts sends it as a
// Bearer header) — live search-as-you-type is favored everywhere a game
// is picked (buyer request form, admin add-game), with an explicit "use
// this title anyway" as the freeform fallback when BGG has no match, is
// slow/down, or this flag is switched off. See components/GameSearchField.tsx.
export const BGG_SEARCH_AVAILABLE = true;
