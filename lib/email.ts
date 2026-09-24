// Transactional email helper (Recommended Approach, plan-eng-review R3-2 /
// TODOS.md): notifies a buyer when the admin responds to their request.
// Failure here is a known accepted gap for the MVP (no in-app status page,
// no retry) — logged so it's at least visible, not silent.

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "no-reply@findmygameparts.example";

export async function sendRequestResponseEmail(params: {
  to: string;
  gameTitle: string;
  partDescription: string;
  status: "AVAILABLE" | "NOT_AVAILABLE";
  price?: string | null;
}): Promise<{ sent: boolean }> {
  if (!resend) {
    console.error("RESEND_API_KEY not configured — email not sent", params);
    return { sent: false };
  }

  const subject =
    params.status === "AVAILABLE"
      ? `Good news — "${params.partDescription}" for ${params.gameTitle} is available`
      : `Update on your request for "${params.partDescription}" (${params.gameTitle})`;

  const body =
    params.status === "AVAILABLE"
      ? `I have your part. Price: ${params.price ?? "TBD"}. Reply to this email to arrange payment and shipping. This claim holds for 5 days from now.`
      : `Sorry — I don't have this part available. I'll keep your request on file in case that changes.`;

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject,
      text: body,
    });
    return { sent: true };
  } catch (error) {
    console.error("Failed to send request-response email", error);
    return { sent: false };
  }
}
