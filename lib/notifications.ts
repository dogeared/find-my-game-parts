import { prisma } from "@/lib/prisma";
import { sendOrderResponseEmail } from "@/lib/email";

// Shared by both the manual "Send notification" action and the automatic
// send that fires once every line item in an order has been triaged
// (see app/api/admin/requests/[id]/route.ts) — both need the exact same
// "fetch the order's current state, summarize it, email the buyer"
// behavior, just triggered differently.
export async function notifyOrder(orderId: string): Promise<{ sent: boolean }> {
  const order = await prisma.partOrder.findUnique({
    where: { id: orderId },
    include: { game: true, requester: true, items: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) {
    return { sent: false };
  }

  return sendOrderResponseEmail({
    to: order.requester.email,
    gameTitle: order.game.title,
    items: order.items.map((item) => ({
      partDescription: item.partDescription,
      quantityRequested: item.quantityRequested,
      status: item.status,
      quantityAvailable: item.quantityAvailable,
      price: item.price?.toString() ?? null,
    })),
  });
}
