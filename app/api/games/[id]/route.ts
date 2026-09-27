import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin-only: toggle a game's public availability. Per D3 (plan-eng-review):
// toggling off does NOT touch that game's pending requests — the admin
// resolves those manually on the triage list, same as always.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { inStock } = (await request.json()) as { inStock: boolean };

  const game = await prisma.game.update({
    where: { id },
    data: { inStock },
  });

  return NextResponse.json({ game });
}
