import { describe, expect, it } from "vitest";
import { formatExtendedPrice } from "./pricing";

describe("formatExtendedPrice", () => {
  it("shows a single price with no extended total for quantity 1", () => {
    expect(formatExtendedPrice("2.00", 1)).toBe("$2.00");
  });

  it("shows the unit price and extended total for quantity > 1", () => {
    expect(formatExtendedPrice("2.00", 5)).toBe("$2.00 each — $10.00 total");
  });

  it("rounds the extended total to two decimal places", () => {
    expect(formatExtendedPrice("1.10", 3)).toBe("$1.10 each — $3.30 total");
  });

  it("returns null when there is no price", () => {
    expect(formatExtendedPrice(null, 5)).toBeNull();
    expect(formatExtendedPrice(undefined, 5)).toBeNull();
    expect(formatExtendedPrice("", 5)).toBeNull();
  });

  it("returns null for a non-numeric price", () => {
    expect(formatExtendedPrice("not-a-number", 5)).toBeNull();
  });
});
