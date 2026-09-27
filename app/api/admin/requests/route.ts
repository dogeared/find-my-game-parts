import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleClaims } from "@/lib/claims";

// Admin-only: datestamp-ordered list per game (Recommended Approach). No
// automatic grouping of freeform text into per-part buckets — the admin
// reads this list and uses judgment (office-hours R3-1 resolution).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await expireStaleClaims();

  const requests = await prisma.partRequest.findMany({
    include: {
      game: { select: { id: true, title: true } },
      requester: { select: { email: true } },
    },
    orderBy: [{ gameId: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ requests });
}
