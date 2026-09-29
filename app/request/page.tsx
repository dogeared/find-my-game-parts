import { RequestPageClient } from "./RequestPageClient";

// Route segment config only takes effect from a Server Component file —
// a "use client" page.tsx silently ignores it (confirmed live: build
// output kept marking this route "○ Static" even with the export present
// directly in the client file). Without this, Next.js statically
// prerenders this page at build time with no CSP nonce baked in, which
// never matches the fresh per-request nonce proxy.ts generates — the
// browser then blocks every script on a real full-page navigation here
// (not a next/link transition, which reuses the already-running client
// and never hits this), leaving the page stuck on the loading fallback
// forever with no visible error. Reported live: a plain markdown link
// (`[text](/request)`, a real <a> tag, not a next/link) hung exactly
// this way — only reproducible against a production build, since
// `next dev` never statically optimizes.
export const dynamic = "force-dynamic";

export default function RequestPage() {
  return <RequestPageClient />;
}
