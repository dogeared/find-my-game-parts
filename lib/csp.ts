// Cloudflare Web Analytics' beacon loads from static.cloudflareinsights.com
// (allowed via the nonce + 'strict-dynamic', not a host allowlist) and
// reports to this origin — the only extra hole analytics needs.
export const CF_ANALYTICS_REPORT_ORIGIN = "https://cloudflareinsights.com";
export const CF_ANALYTICS_BEACON_SRC =
  "https://static.cloudflareinsights.com/beacon.min.js";

// Beacon tokens are 32 hex chars. Rejecting anything else means a typo'd
// env var disables analytics instead of rendering a broken script tag.
export function isValidCfAnalyticsToken(token: string | undefined): token is string {
  return typeof token === "string" && /^[a-f0-9]{32}$/i.test(token);
}

export function buildCsp(
  nonce: string,
  { isDev, analytics }: { isDev: boolean; analytics: boolean },
): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    // Only opened when analytics is actually configured — least privilege.
    `connect-src 'self'${analytics ? ` ${CF_ANALYTICS_REPORT_ORIGIN}` : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");
}
