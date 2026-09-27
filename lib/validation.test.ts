import { describe, expect, it } from "vitest";
import { MAX_QUANTITY, MAX_TEXT_LENGTH, clampQuantity, isValidOptionalText, isValidPrice, isValidText } from "./validation";

describe("isValidText", () => {
  it("rejects empty/whitespace-only strings", () => {
    expect(isValidText("")).toBe(false);
    expect(isValidText("   ")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidText(undefined)).toBe(false);
    expect(isValidText(123)).toBe(false);
  });

  it("rejects text over the max length", () => {
    expect(isValidText("a".repeat(MAX_TEXT_LENGTH + 1))).toBe(false);
  });

  it("accepts reasonable text up to the limit", () => {
    expect(isValidText("Stealth Rohan card")).toBe(true);
    expect(isValidText("a".repeat(MAX_TEXT_LENGTH))).toBe(true);
  });
});

describe("clampQuantity", () => {
  it("defaults invalid/missing input to 1", () => {
    expect(clampQuantity(undefined)).toBe(1);
    expect(clampQuantity("not a number")).toBe(1);
    expect(clampQuantity(NaN)).toBe(1);
  });

  it("clamps to at least 1 (rejects zero/negative)", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-5)).toBe(1);
  });

  it("clamps to the maximum instead of allowing arbitrarily large values", () => {
    expect(clampQuantity(999999999)).toBe(MAX_QUANTITY);
  });

  it("truncates fractional quantities", () => {
    expect(clampQuantity(3.9)).toBe(3);
  });
});

describe("isValidOptionalText", () => {
  it("treats missing/empty as valid (it's optional)", () => {
    expect(isValidOptionalText(undefined)).toBe(true);
    expect(isValidOptionalText(null)).toBe(true);
    expect(isValidOptionalText("")).toBe(true);
  });

  it("still enforces the length cap when present", () => {
    expect(isValidOptionalText("a".repeat(MAX_TEXT_LENGTH + 1))).toBe(false);
  });
});

describe("isValidPrice", () => {
  it("treats missing/empty as valid (it's optional)", () => {
    expect(isValidPrice(undefined)).toBe(true);
    expect(isValidPrice("")).toBe(true);
  });

  it("rejects non-numeric garbage", () => {
    expect(isValidPrice("not a price")).toBe(false);
    expect(isValidPrice("$10; DROP TABLE")).toBe(false);
  });

  it("rejects negative prices", () => {
    expect(isValidPrice(-10)).toBe(false);
  });

  it("rejects unreasonably large prices", () => {
    expect(isValidPrice(999_999_999)).toBe(false);
  });

  it("accepts normal prices as string or number", () => {
    expect(isValidPrice("10")).toBe(true);
    expect(isValidPrice(10)).toBe(true);
  });
});
