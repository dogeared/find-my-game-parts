// Transactional email helper (Recommended Approach, plan-eng-review R3-2 /
// TODOS.md): notifies a buyer when the admin responds to their request.
// Failure here is a known accepted gap for the MVP (no in-app status page,
// no retry) — logged so it's at least visible, not silent.
//
// Bundled part requests: one order can have several line items, each
// triaged independently, so this sends one email per order summarizing
// every item's current state rather than one email per item. It's called
// again after each per-item triage action, so the buyer always sees the
// order's full current picture (not just what just changed).

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "no-reply@findmygameparts.example";

export type OrderEmailItem = {
  partDescription: string;
  quantityRequested: number;
  status: "PENDING" | "AVAILABLE" | "NOT_AVAILABLE";
  quantityAvailable?: number | null;
  price?: string | null;
};

export async function sendOrderResponseEmail(params: {
  to: string;
  gameTitle: string;
  items: OrderEmailItem[];
}): Promise<{ sent: boolean }> {
  if (!resend) {
    console.error("RESEND_API_KEY not configured — email not sent", params);
    return { sent: false };
  }

  const decided = params.items.filter((item) => item.status !== "PENDING");
  const allAvailable = decided.length > 0 && decided.every((item) => item.status === "AVAILABLE");
  const anyAvailable = decided.some((item) => item.status === "AVAILABLE");

  const subject = allAvailable
    ? `Good news — everything you asked about for ${params.gameTitle} is available`
    : anyAvailable
      ? `Update on your request for ${params.gameTitle} — some parts available`
      : `Update on your request for ${params.gameTitle}`;

  const lines = params.items.map((item) => {
    if (item.status === "PENDING") {
      return `- ${item.partDescription} (qty ${item.quantityRequested}): still checking`;
    }
    if (item.status === "NOT_AVAILABLE") {
      return `- ${item.partDescription} (qty ${item.quantityRequested}): not available`;
    }
    const qtyNote =
      item.quantityAvailable != null && item.quantityAvailable < item.quantityRequested
        ? ` (only ${item.quantityAvailable} of ${item.quantityRequested} available)`
        : "";
    return `- ${item.partDescription} (qty ${item.quantityRequested}): available${qtyNote} — $${item.price ?? "TBD"}`;
  });

  const body = [
    `Here's where things stand on your request for ${params.gameTitle}:`,
    "",
    ...lines,
    "",
    anyAvailable
      ? "Reply to this email to arrange payment and shipping for the available part(s). Each claim holds for 5 days from now."
      : "I'll keep the rest of your request on file in case that changes.",
  ].join("\n");

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject,
      text: body,
    });
    return { sent: true };
  } catch (error) {
    console.error("Failed to send order-response email", error);
    return { sent: false };
  }
}
