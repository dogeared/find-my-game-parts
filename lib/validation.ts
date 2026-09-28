// Shared input bounds for the API routes we own (D1: one small helper, not
// a validation library, for the handful of fields we actually accept).
// None of this is enforced by Prisma/Postgres on its own — without it,
// anyone can POST a megabyte of text into partDescription or pass
// quantity: 999999999.

export const MAX_TEXT_LENGTH = 500;
export const MAX_QUANTITY = 999;
export const MAX_PRICE = 100_000;
// The About page is freeform admin-written markdown, not a short field —
// 500 chars wouldn't fit a single paragraph. 20,000 is generous (a few
// thousand words) while still bounding worst-case size.
export const MAX_ABOUT_LENGTH = 20_000;

export function isValidText(value: unknown, maxLength = MAX_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function clampQuantity(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_QUANTITY);
}

// maxPrice/editionNote are optional — undefined/empty is always valid.
export function isValidOptionalText(value: unknown, maxLength = MAX_TEXT_LENGTH): boolean {
  return value === undefined || value === null || value === "" || isValidText(value, maxLength);
}

export function isValidPrice(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string" && typeof value !== "number") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_PRICE;
}
