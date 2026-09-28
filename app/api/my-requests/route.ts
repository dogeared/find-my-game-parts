import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireStaleClaims } from "@/lib/claims";

// Buyer-facing: a signed-in user's own orders and their line items' current
// status, so they don't have to rely solely on email to know where a
// request stands. Scoped strictly to session.user.id — this must never
// leak another requester's orders (see TODOS.md's public-PII note, same
// concern applies here even though this route IS authenticated).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  await expireStaleClaims();

  const orders = await prisma.partOrder.findMany({
    where: { requesterId: session.user.id },
    include: {
      game: { select: { id: true, title: true, bggId: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
