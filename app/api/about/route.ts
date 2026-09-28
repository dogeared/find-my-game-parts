import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_ABOUT_LENGTH, isValidText } from "@/lib/validation";

const ABOUT_ID = "about";

// Public — the About page's own content is meant to be public, so the
// read side has no auth check (only the write side, below, is admin-only).
export async function GET() {
  const about = await prisma.aboutPage.findUnique({ where: { id: ABOUT_ID } });
  return NextResponse.json({ markdown: about?.markdown ?? "" });
}

// Admin-only: the whole point of storing this in the DB instead of a
// file is that an admin can update it without a redeploy.
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { markdown } = body as { markdown?: string };

  if (!isValidText(markdown, MAX_ABOUT_LENGTH)) {
    return NextResponse.json(
      { error: `Content is required (${MAX_ABOUT_LENGTH} characters max)` },
      { status: 400 },
    );
  }

  const about = await prisma.aboutPage.upsert({
    where: { id: ABOUT_ID },
    update: { markdown },
    create: { id: ABOUT_ID, markdown },
  });

  return NextResponse.json({ markdown: about.markdown });
}
