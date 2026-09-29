import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Stop leaking framework/version info for free — the CSP itself (which
  // needs a per-request nonce) is set in proxy.ts, not here, since these
  // static headers can't carry dynamic values.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Browsers ignore HSTS over plain HTTP, so this is inert locally.
          // includeSubDomains is safe because every subdomain (www, auth)
          // serves HTTPS; any future subdomain must too. No `preload` yet —
          // getting off the browsers' preload list takes months.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
