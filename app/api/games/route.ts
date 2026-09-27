import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchBggGames } from "@/lib/bgg";
import { isValidText } from "@/lib/validation";

// Public callers see only in-stock games. Admins see everything (including
// not-yet-stocked games auto-created by buyer requests) so they can toggle
// availability. Either way: explicit `select`, never a PartRequest join
// (Architecture Review AR-4 / TODOS.md — PII-safe public read model).
export async function GET() {
  const session = await getServerSession(authOptions);
  const isAdmin = Boolean(session?.user?.isAdmin);

  const games = await prisma.game.findMany({
    where: isAdmin ? {} : { inStock: true },
    select: { id: true, title: true, bggId: true, inStock: true },
    orderBy: { title: "asc" },
  });
  return NextResponse.json({ games });
}

// Admin-only: add a game via BGG lookup, with manual fallback if the
// lookup fails/returns nothing (Dependencies in the design doc).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, bggId } = body as { title?: string; bggId?: string };

  if (!isValidText(title)) {
    return NextResponse.json({ error: "title is required (500 characters max)" }, { status: 400 });
  }

  let resolvedBggId = bggId ?? null;
  if (!resolvedBggId) {
    const [match] = await searchBggGames(title);
    resolvedBggId = match?.bggId ?? null; // null is fine — manual fallback path
  }

  const game = await prisma.game.create({
    data: { title: title.trim(), bggId: resolvedBggId, inStock: true },
  });

  return NextResponse.json({ game }, { status: 201 });
}
