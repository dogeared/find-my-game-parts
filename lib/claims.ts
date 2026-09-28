import { prisma } from "@/lib/prisma";
import { CLAIM_WINDOW_MS } from "@/lib/constants";

// Checked on read rather than a real background job — consistent with the
// MVP's manual-everything philosophy; a real cron-based expiry is a
// TODOS.md-worthy follow-up if this matters at higher volume.

export async function expireStaleClaims(): Promise<number> {
  const cutoff = new Date(Date.now() - CLAIM_WINDOW_MS);

  const expired = await prisma.partRequest.findMany({
    where: { status: "AVAILABLE", claimedAt: { lt: cutoff } },
  });

  for (const request of expired) {
    await prisma.partRequest.update({
      where: { id: request.id },
      data: { status: "PENDING", claimedAt: null, price: null, quantityAvailable: null },
    });
  }

  return expired.length;
}
