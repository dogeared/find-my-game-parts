import { headers } from "next/headers";
import { CF_ANALYTICS_BEACON_SRC, isValidCfAnalyticsToken } from "@/lib/csp";

// Manual beacon rather than Cloudflare's edge auto-injection: the injected
// script carries no nonce, so our strict CSP would block it. Off unless the
// token is set, which keeps local/dev/CI traffic out of the numbers.
// The beacon follows client-side navigations itself (History API), so
// rendering it once in the root layout counts every page view.
export async function CloudflareAnalytics() {
  const token = process.env.CF_WEB_ANALYTICS_TOKEN;
  if (!isValidCfAnalyticsToken(token)) return null;

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      defer
      src={CF_ANALYTICS_BEACON_SRC}
      data-cf-beacon={JSON.stringify({ token })}
      nonce={nonce}
    />
  );
}
