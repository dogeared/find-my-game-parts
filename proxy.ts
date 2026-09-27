import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

// Application-layer rate limiting, not real DDoS protection — a true
// volumetric/network-layer attack has to be stopped upstream (Render's own
// edge, or a CDN/WAF in front of it), not by anything running inside the
// app process. What this DOES do: blunt request-flooding and brute-force
// abuse against our own endpoints (login attempts, request-form spam,
// scraping) before it reaches Next.js routing or the database.
//
// In-memory, not Redis-backed: this app runs as a single Node process
// (one `next start` container, not distributed/edge), so there's no
// multi-instance state to share. Revisit if this ever scales to multiple
// app instances behind a load balancer.
const limiter = new RateLimiterMemory({
  points: 120, // requests
  duration: 60, // per 60 seconds, per IP
});

// Stricter, separate budget for the request-submission endpoint
// specifically — 120/min (the global limit) is far too generous for "spam
// the request form," which is a real, narrow abuse vector this app
// actually has.
const requestSubmitLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

export const config = {
  matcher: [
    /*
     * Apply to everything except static assets and Next's internal paths —
     * those aren't meaningful abuse targets and don't need consuming a
     * request from the same per-IP budget as real traffic.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

function tooManyRequests(rateLimiterRes: unknown) {
  const msBeforeNext =
    rateLimiterRes && typeof rateLimiterRes === "object" && "msBeforeNext" in rateLimiterRes
      ? (rateLimiterRes as { msBeforeNext: number }).msBeforeNext
      : 60000;
  return new NextResponse("Too many requests", {
    status: 429,
    headers: { "Retry-After": String(Math.ceil(msBeforeNext / 1000)) },
  });
}

export async function proxy(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

  try {
    await limiter.consume(ip);
    if (request.method === "POST" && request.nextUrl.pathname === "/api/requests") {
      await requestSubmitLimiter.consume(ip);
    }
  } catch (rateLimiterRes) {
    return tooManyRequests(rateLimiterRes);
  }

  // Content-Security-Policy, following Next.js's own documented nonce
  // pattern: the framework auto-applies this nonce to its own internally
  // generated inline hydration scripts once it sees a `Content-Security-Policy`
  // header (with a 'nonce-...' token) on the REQUEST, not just the response
  // — so it has to be set on both. We removed every inline style={{}} in
  // the app for exactly this reason, so style-src doesn't need
  // 'unsafe-inline' either.
  const nonce = Buffer.from(randomUUID()).toString("base64");
  // React's dev mode needs eval() for debugging (call-stack reconstruction)
  // — confirmed live via a real console warning ("eval() is not supported
  // in this environment") once the strict CSP went in locally. React
  // itself states it "will never use eval() in production", so this only
  // loosens script-src in dev, never in the actual deployed app.
  const isDev = process.env.NODE_ENV !== "production";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}
