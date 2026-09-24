import { prisma } from "@/lib/prisma";

// 5-day claim window (outside-voice finding #5, plan-eng-review): if the
// earliest requester for a scarce/unique part doesn't confirm and pay
// within 5 days of being notified, the claim passes to the next-earliest
// pending request for that same game. Checked on read rather than a real
// background job — consistent with the MVP's manual-everything philosophy;
// a real cron-based expiry is a TODOS.md-worthy follow-up if this matters
// at higher volume.
const CLAIM_WINDOW_MS = 5 * 24 * 60 * 60 * 1000;

export async function expireStaleClaims(): Promise<number> {
  const cutoff = new Date(Date.now() - CLAIM_WINDOW_MS);

  const expired = await prisma.partRequest.findMany({
    where: { status: "AVAILABLE", claimedAt: { lt: cutoff } },
  });

  for (const request of expired) {
    await prisma.partRequest.update({
      where: { id: request.id },
      data: { status: "PENDING", claimedAt: null, price: null },
    });
  }

  return expired.length;
}
