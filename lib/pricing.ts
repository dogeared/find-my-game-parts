// Dependency-free (safe for client and server, same reasoning as
// lib/constants.ts). Admin enters price PER ITEM; every place price is
// shown (admin triage, buyer's My Requests, email) needs the same
// extended-total math, so it lives here once instead of three times.
export function formatExtendedPrice(
  pricePerItem: string | null | undefined,
  quantity: number
): string | null {
  if (!pricePerItem) return null;
  const unit = Number(pricePerItem);
  if (!Number.isFinite(unit)) return null;

  if (quantity > 1) {
    const total = unit * quantity;
    return `$${unit.toFixed(2)} each — $${total.toFixed(2)} total`;
  }
  return `$${unit.toFixed(2)}`;
}
