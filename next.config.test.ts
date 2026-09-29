import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("next.config security headers", () => {
  it("sends HSTS on every path", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*");
    expect(all?.headers).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  });
});
