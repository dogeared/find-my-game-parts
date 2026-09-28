import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  clampQuantity,
  isValidOptionalText,
  isValidPrice,
  isValidText,
  MAX_ITEMS_PER_ORDER,
} from "@/lib/validation";

type ItemInput = {
  partDescription?: string;
  quantity?: number;
  editionNote?: string;
  maxPrice?: string;
};

// Auth required — browsing is free, submitting a request is not
// (Constraints in the design doc). A buyer can request ANY BGG game,
// owned or not (Narrowest Wedge) — this endpoint upserts a Game row by
// bggId (or by title, for the manual-fallback path) rather than requiring
// one to already exist. New games created this way default to
// inStock:false; only the admin add-game flow marks a game inStock:true.
//
// One submission = one PartOrder (game + requester) with N PartRequest line
// items (bundled part requests) — lets a buyer ask for several different
// parts for the same game (e.g. a unique card + a stack of meeples) in one
// go, each independently triaged by the admin.
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
    items,
  } = body as {
    gameId?: string;
    bggId?: string;
    gameTitle?: string;
    items?: ItemInput[];
  };

  if (!gameId && !isValidText(gameTitle)) {
    return NextResponse.json({ error: "A game is required" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one part is required" }, { status: 400 });
  }
  if (items.length > MAX_ITEMS_PER_ORDER) {
    return NextResponse.json({ error: `At most ${MAX_ITEMS_PER_ORDER} parts per request` }, { status: 400 });
  }
  for (const item of items) {
    if (!isValidText(item.partDescription)) {
      return NextResponse.json(
        { error: "Every part needs a description (500 characters max)" },
        { status: 400 }
      );
    }
    if (!isValidOptionalText(item.editionNote)) {
      return NextResponse.json({ error: "Edition note is too long (500 characters max)" }, { status: 400 });
    }
    if (!isValidPrice(item.maxPrice)) {
      return NextResponse.json({ error: "Max price must be a reasonable positive number" }, { status: 400 });
    }
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

  const order = await prisma.partOrder.create({
    data: {
      gameId: resolvedGameId,
      requesterId: session.user.id,
      items: {
        create: items.map((item) => ({
          partDescription: item.partDescription!.trim(),
          quantityRequested: clampQuantity(item.quantity),
          editionNote: item.editionNote?.trim() || null,
          maxPrice: item.maxPrice ? item.maxPrice : null,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json({ order }, { status: 201 });
}
