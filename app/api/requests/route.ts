import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clampQuantity, isValidOptionalText, isValidPrice, isValidText } from "@/lib/validation";

// Auth required — browsing is free, submitting a request is not
// (Constraints in the design doc). A buyer can request ANY BGG game,
// owned or not (Narrowest Wedge) — this endpoint upserts a Game row by
// bggId (or by title, for the manual-fallback path) rather than requiring
// one to already exist. New games created this way default to
// inStock:false; only the admin add-game flow marks a game inStock:true.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await request.json();
  const {
    gameId, // pre-existing internal Game.id, when requesting from the public inventory list
    bggId, // from BGG search-as-you-type, when requesting a game we don't have
    gameTitle,
    partDescription,
    quantity,
    editionNote,
    maxPrice,
  } = body as {
    gameId?: string;
    bggId?: string;
    gameTitle?: string;
    partDescription?: string;
    quantity?: number;
    editionNote?: string;
    maxPrice?: string;
  };

  if (!isValidText(partDescription) || (!gameId && !isValidText(gameTitle))) {
    return NextResponse.json(
      { error: "A game and part description are required (500 characters max)" },
      { status: 400 }
    );
  }
  if (!isValidOptionalText(editionNote)) {
    return NextResponse.json({ error: "Edition note is too long (500 characters max)" }, { status: 400 });
  }
  if (!isValidPrice(maxPrice)) {
    return NextResponse.json({ error: "Max price must be a reasonable positive number" }, { status: 400 });
  }

  let resolvedGameId = gameId ?? null;
  if (!resolvedGameId) {
    const existing = bggId
      ? await prisma.game.findFirst({ where: { bggId } })
      : await prisma.game.findFirst({ where: { title: gameTitle!.trim() } });

    resolvedGameId = existing
      ? existing.id
      : (
          await prisma.game.create({
            data: { title: gameTitle!.trim(), bggId: bggId ?? null, inStock: false },
          })
        ).id;
  }

  const partRequest = await prisma.partRequest.create({
    data: {
      gameId: resolvedGameId,
      requesterId: session.user.id,
      partDescription: partDescription.trim(),
      quantity: clampQuantity(quantity),
      editionNote: editionNote?.trim() || null,
      maxPrice: maxPrice ? maxPrice : null,
    },
  });

  return NextResponse.json({ request: partRequest }, { status: 201 });
}
