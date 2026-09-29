import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidOptionalText, MAX_EMAIL_FOOTER_LENGTH } from "@/lib/validation";

const EMAIL_FOOTER_ID = "footer";

// Admin-only both ways — unlike AboutPage, this has no public-facing use;
// it only ever appears appended inside outgoing emails (lib/email.ts).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const footer = await prisma.emailFooter.findUnique({ where: { id: EMAIL_FOOTER_ID } });
  return NextResponse.json({ text: footer?.text ?? "" });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { text } = body as { text?: string };

  // Empty is valid — an admin can clear the footer entirely.
  if (!isValidOptionalText(text, MAX_EMAIL_FOOTER_LENGTH)) {
    return NextResponse.json(
      { error: `Footer is too long (${MAX_EMAIL_FOOTER_LENGTH} characters max)` },
      { status: 400 }
    );
  }

  const footer = await prisma.emailFooter.upsert({
    where: { id: EMAIL_FOOTER_ID },
    update: { text: text ?? "" },
    create: { id: EMAIL_FOOTER_ID, text: text ?? "" },
  });

  return NextResponse.json({ text: footer.text });
}
