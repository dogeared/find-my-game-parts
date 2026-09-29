import { describe, expect, it } from "vitest";
import { buildCsp, isValidCfAnalyticsToken } from "./csp";

const TOKEN = "0123456789abcdef0123456789abcdef";

describe("isValidCfAnalyticsToken", () => {
  it("accepts a 32-char hex token", () => {
    expect(isValidCfAnalyticsToken(TOKEN)).toBe(true);
  });

  it.each([undefined, "", "abc", `${TOKEN}0`, `"}<script>`, TOKEN.replace("a", "z")])(
    "rejects %s",
    (token) => {
      expect(isValidCfAnalyticsToken(token)).toBe(false);
    },
  );
});

describe("buildCsp", () => {
  it("keeps connect-src same-origin when analytics is off", () => {
    const csp = buildCsp("n", { isDev: false, analytics: false });
    expect(csp).toContain("connect-src 'self';");
    expect(csp).not.toContain("cloudflareinsights");
  });

  it("allows only the Cloudflare report origin when analytics is on", () => {
    const csp = buildCsp("n", { isDev: false, analytics: true });
    expect(csp).toContain("connect-src 'self' https://cloudflareinsights.com;");
  });

  it("only allows eval in dev", () => {
    expect(buildCsp("n", { isDev: true, analytics: false })).toContain("'unsafe-eval'");
    expect(buildCsp("n", { isDev: false, analytics: false })).not.toContain("'unsafe-eval'");
  });

  it("embeds the nonce with strict-dynamic", () => {
    expect(buildCsp("abc", { isDev: false, analytics: false })).toContain(
      "script-src 'self' 'nonce-abc' 'strict-dynamic'",
    );
  });
});
