import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => send(...args) };
  },
}));

process.env.RESEND_API_KEY = "test-key";
const { sendOrderResponseEmail } = await import("./email");

describe("sendOrderResponseEmail", () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({});
  });

  it("sends a single-line summary when every item is available", async () => {
    const { sent } = await sendOrderResponseEmail({
      to: "buyer@example.com",
      gameTitle: "Fate of the Fellowship",
      items: [
        {
          partDescription: "Rohan Stealth card",
          quantityRequested: 1,
          status: "AVAILABLE",
          quantityAvailable: 1,
          price: "5.00",
        },
      ],
    });

    expect(sent).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0][0];
    expect(call.subject).toContain("everything you asked about");
    expect(call.text).toContain("Rohan Stealth card (qty 1): available — $5.00");
    expect(call.text).toContain("Each claim holds for 5 days");
  });

  it("flags a partial quantity and mixed subject when some items are available and some are not", async () => {
    const { sent } = await sendOrderResponseEmail({
      to: "buyer@example.com",
      gameTitle: "Fate of the Fellowship",
      items: [
        {
          partDescription: "Rohan Stealth card",
          quantityRequested: 1,
          status: "NOT_AVAILABLE",
        },
        {
          partDescription: "Shadow Warrior meeple",
          quantityRequested: 10,
          status: "AVAILABLE",
          quantityAvailable: 5,
          price: "20.00",
        },
      ],
    });

    expect(sent).toBe(true);
    const call = send.mock.calls[0][0];
    expect(call.subject).toContain("some parts available");
    expect(call.text).toContain("Rohan Stealth card (qty 1): not available");
    expect(call.text).toContain(
      "Shadow Warrior meeple (qty 10): available (only 5 of 10 available) — $20.00 each — $100.00 total"
    );
  });

  it("uses the not-available subject and closing line when nothing is available", async () => {
    const { sent } = await sendOrderResponseEmail({
      to: "buyer@example.com",
      gameTitle: "Fate of the Fellowship",
      items: [
        { partDescription: "Rohan Stealth card", quantityRequested: 1, status: "NOT_AVAILABLE" },
      ],
    });

    expect(sent).toBe(true);
    const call = send.mock.calls[0][0];
    expect(call.subject).not.toContain("everything");
    expect(call.subject).not.toContain("some parts available");
    expect(call.text).toContain("I'll keep the rest of your request on file");
  });

  it("shows still-pending items alongside decided ones", async () => {
    await sendOrderResponseEmail({
      to: "buyer@example.com",
      gameTitle: "Fate of the Fellowship",
      items: [
        { partDescription: "Rohan Stealth card", quantityRequested: 1, status: "AVAILABLE", price: "5.00" },
        { partDescription: "Shadow Warrior meeple", quantityRequested: 10, status: "PENDING" },
      ],
    });

    const call = send.mock.calls[0][0];
    expect(call.text).toContain("Shadow Warrior meeple (qty 10): still checking");
  });

  it("returns sent:false and logs without calling Resend when send() rejects", async () => {
    send.mockRejectedValue(new Error("network error"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { sent } = await sendOrderResponseEmail({
      to: "buyer@example.com",
      gameTitle: "Fate of the Fellowship",
      items: [
        { partDescription: "Rohan Stealth card", quantityRequested: 1, status: "AVAILABLE", price: "5.00" },
      ],
    });

    expect(sent).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("returns sent:false without calling Resend when RESEND_API_KEY is unset", async () => {
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { sendOrderResponseEmail: sendWithoutKey } = await import("./email");
    const { sent } = await sendWithoutKey({
      to: "buyer@example.com",
      gameTitle: "Fate of the Fellowship",
      items: [
        { partDescription: "Rohan Stealth card", quantityRequested: 1, status: "AVAILABLE", price: "5.00" },
      ],
    });

    expect(sent).toBe(false);
    expect(send).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    process.env.RESEND_API_KEY = "test-key";
  });
});
