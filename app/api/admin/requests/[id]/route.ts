import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyOrder } from "@/lib/notifications";
import { isValidPrice } from "@/lib/validation";

type PatchBody = {
  criticalityTag?: "UNIQUE" | "FUNGIBLE";
  status?: "AVAILABLE" | "NOT_AVAILABLE";
  price?: string;
  quantityAvailable?: number;
};

// Admin-only: triage a single line item within an order (set the
// criticality tag, and/or respond available+price+quantity or
// not-available). Marking AVAILABLE starts the 5-day claim window
// (lib/claims.ts) for THIS item only — other items in the same order keep
// their own independent status/clock.
//
// Notification: the buyer is emailed automatically only once every item in
// the order has been decided (no PENDING items left) — not after every
// single item, which would spam a multi-item order with one email per
// decision. Before that point, the admin can still notify manually at any
// time via POST /api/admin/orders/[orderId]/notify.
//
// Double-approve guard (Architecture Review AR-1 / D2): this does NOT
// prevent a true simultaneous double-approval in two browser tabs — it
// returns the other still-pending items for the same game (across orders)
// so the admin UI can nudge a cleanup right after approval, which covers
// the far more common "forgot this was already claimed" case.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as PatchBody;

  if (body.status === "AVAILABLE" && !isValidPrice(body.price)) {
    return NextResponse.json({ error: "Price must be a reasonable positive number" }, { status: 400 });
  }

  const existing = await prisma.partRequest.findUnique({
    where: { id },
    include: { order: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const quantityAvailable =
    body.status === "AVAILABLE"
      ? Math.min(
          Math.max(Math.trunc(body.quantityAvailable ?? existing.quantityRequested), 1),
          existing.quantityRequested
        )
      : undefined;

  const updated = await prisma.partRequest.update({
    where: { id },
    data: {
      ...(body.criticalityTag ? { criticalityTag: body.criticalityTag } : {}),
      ...(body.status === "AVAILABLE"
        ? { status: "AVAILABLE", price: body.price ?? null, quantityAvailable, claimedAt: new Date() }
        : {}),
      ...(body.status === "NOT_AVAILABLE" ? { status: "NOT_AVAILABLE", quantityAvailable: 0 } : {}),
    },
  });

  let otherPendingForGame: Array<{ id: string; partDescription: string; createdAt: Date }> = [];
  let orderNotified = false;

  if (body.status) {
    const orderItemStatuses = await prisma.partRequest.findMany({
      where: { orderId: existing.orderId },
      select: { status: true },
    });
    const allDecided = orderItemStatuses.every((item) => item.status !== "PENDING");

    if (allDecided) {
      const { sent } = await notifyOrder(existing.orderId);
      orderNotified = sent;
      if (!sent) {
        console.error(`Notification email failed for order ${existing.orderId} — buyer not informed`);
      }
    }

    if (body.status === "AVAILABLE") {
      otherPendingForGame = await prisma.partRequest.findMany({
        where: { order: { gameId: existing.order.gameId }, status: "PENDING", id: { not: id } },
        select: { id: true, partDescription: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
    }
  }

  return NextResponse.json({ request: updated, otherPendingForGame, orderNotified });
}
