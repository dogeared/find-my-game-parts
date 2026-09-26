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

export const config = {
  runtime: "nodejs",
  matcher: [
    /*
     * Apply to everything except static assets and Next's internal paths —
     * those aren't meaningful abuse targets and don't need consuming a
     * request from the same per-IP budget as real traffic.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

  try {
    await limiter.consume(ip);
  } catch (rateLimiterRes) {
    const msBeforeNext =
      rateLimiterRes && typeof rateLimiterRes === "object" && "msBeforeNext" in rateLimiterRes
        ? (rateLimiterRes as { msBeforeNext: number }).msBeforeNext
        : 60000;
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(msBeforeNext / 1000)) },
    });
  }

  return NextResponse.next();
}
