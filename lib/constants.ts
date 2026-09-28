// Dependency-free shared constants — safe to import from both server code
// (lib/claims.ts) and client components (app/my-requests/page.tsx). Do not
// add imports here; anything with server-only dependencies (e.g. Prisma)
// would get bundled into client code that imports this file.

// 5-day claim window (outside-voice finding #5, plan-eng-review): if the
// earliest requester for a scarce/unique part doesn't confirm and pay
// within 5 days of being notified, the claim passes to the next-earliest
// pending request for that same game.
export const CLAIM_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
