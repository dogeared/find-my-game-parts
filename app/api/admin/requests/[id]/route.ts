import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendRequestResponseEmail } from "@/lib/email";
import { isValidPrice } from "@/lib/validation";

type PatchBody = {
  criticalityTag?: "UNIQUE" | "FUNGIBLE";
  status?: "AVAILABLE" | "NOT_AVAILABLE";
  price?: string;
};

// Admin-only: triage a single request (set the criticality tag, and/or
// respond available+price or not-available). Marking AVAILABLE starts the
// 5-day claim window (lib/claims.ts).
//
// Double-approve guard (Architecture Review AR-1 / D2): this does NOT
// prevent a true simultaneous double-approval in two browser tabs — it
// returns the other still-pending requests for the same game so the admin
// UI can nudge a cleanup right after approval, which covers the far more
// common "forgot this was already claimed" case.
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
    include: { game: true, requester: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.partRequest.update({
    where: { id },
    data: {
      ...(body.criticalityTag ? { criticalityTag: body.criticalityTag } : {}),
      ...(body.status === "AVAILABLE"
        ? { status: "AVAILABLE", price: body.price ?? null, claimedAt: new Date() }
        : {}),
      ...(body.status === "NOT_AVAILABLE" ? { status: "NOT_AVAILABLE" } : {}),
    },
  });

  let otherPendingForGame: Array<{ id: string; partDescription: string; createdAt: Date }> = [];

  if (body.status) {
    const { sent } = await sendRequestResponseEmail({
      to: existing.requester.email,
      gameTitle: existing.game.title,
      partDescription: existing.partDescription,
      status: body.status,
      price: body.price,
    });
    if (!sent) {
      console.error(`Notification email failed for request ${id} — buyer not informed`);
    }

    if (body.status === "AVAILABLE") {
      otherPendingForGame = await prisma.partRequest.findMany({
        where: { gameId: existing.gameId, status: "PENDING", id: { not: id } },
        select: { id: true, partDescription: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
    }
  }

  return NextResponse.json({ request: updated, otherPendingForGame });
}
