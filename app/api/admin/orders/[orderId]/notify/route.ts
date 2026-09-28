import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notifyOrder } from "@/lib/notifications";

// Admin-only: manually (re)send the order-summary notification at any
// point in triage. Always available, regardless of order size or how many
// items are still PENDING — lets the admin tell the buyer what's decided
// so far without waiting for every line item to be resolved.
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;
  const { sent } = await notifyOrder(orderId);

  return NextResponse.json({ sent });
}
