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

import { Client, type SendEmailV3_1 } from "node-mailjet";
import { formatExtendedPrice } from "@/lib/pricing";

// Same provider Keycloak already sends through for this domain (SMTP,
// keycloak/setup-realm.sh) — consolidating here avoids a second
// domain-verification/deliverability setup for one extra service.
const mailjet =
  process.env.MJ_APIKEY_PUBLIC && process.env.MJ_APIKEY_PRIVATE
    ? new Client({ apiKey: process.env.MJ_APIKEY_PUBLIC, apiSecret: process.env.MJ_APIKEY_PRIVATE })
    : null;
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "noreply@findmygame.parts";

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
  if (!mailjet) {
    console.error("MJ_APIKEY_PUBLIC/MJ_APIKEY_PRIVATE not configured — email not sent", params);
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
    const price =
      formatExtendedPrice(item.price, item.quantityAvailable ?? item.quantityRequested) ?? "TBD";
    return `- ${item.partDescription} (qty ${item.quantityRequested}): available${qtyNote} — ${price}`;
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
    const request: SendEmailV3_1.Body = {
      Messages: [
        {
          From: { Email: FROM_ADDRESS },
          To: [{ Email: params.to }],
          Subject: subject,
          TextPart: body,
        },
      ],
    };
    await mailjet.post("send", { version: "v3.1" }).request(request);
    return { sent: true };
  } catch (error) {
    console.error("Failed to send order-response email", error);
    return { sent: false };
  }
}
