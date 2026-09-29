import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.fn();
const findUniqueFooter = vi.fn();

vi.mock("node-mailjet", () => ({
  Client: class {
    post(_endpoint: string, _opts: unknown) {
      return { request: (...args: unknown[]) => request(...args) };
    }
  },
}));

vi.mock("./prisma", () => ({
  prisma: { emailFooter: { findUnique: (...args: unknown[]) => findUniqueFooter(...args) } },
}));

process.env.MJ_APIKEY_PUBLIC = "test-public-key";
process.env.MJ_APIKEY_PRIVATE = "test-private-key";
const { sendOrderResponseEmail } = await import("./email");

function messageFrom(call: number) {
  return request.mock.calls[call][0].Messages[0];
}

describe("sendOrderResponseEmail", () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({});
    findUniqueFooter.mockReset();
    findUniqueFooter.mockResolvedValue(null);
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
    expect(request).toHaveBeenCalledTimes(1);
    const message = messageFrom(0);
    expect(message.To).toEqual([{ Email: "buyer@example.com" }]);
    expect(message.Subject).toContain("everything you asked about");
    expect(message.TextPart).toContain("Rohan Stealth card (qty 1): available — $5.00");
    expect(message.TextPart).toContain("Each claim holds for 5 days");
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
    const message = messageFrom(0);
    expect(message.Subject).toContain("some parts available");
    expect(message.TextPart).toContain("Rohan Stealth card (qty 1): not available");
    expect(message.TextPart).toContain(
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
    const message = messageFrom(0);
    expect(message.Subject).not.toContain("everything");
    expect(message.Subject).not.toContain("some parts available");
    expect(message.TextPart).toContain("I'll keep the rest of your request on file");
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

    const message = messageFrom(0);
    expect(message.TextPart).toContain("Shadow Warrior meeple (qty 10): still checking");
  });

  it("appends the configured footer to every email", async () => {
    findUniqueFooter.mockResolvedValue({ text: "Find My Game Parts — findmygame.parts" });

    await sendOrderResponseEmail({
      to: "buyer@example.com",
      gameTitle: "Fate of the Fellowship",
      items: [
        { partDescription: "Rohan Stealth card", quantityRequested: 1, status: "AVAILABLE", price: "5.00" },
      ],
    });

    const message = messageFrom(0);
    expect(message.TextPart).toContain("Find My Game Parts — findmygame.parts");
    expect(message.TextPart.endsWith("Find My Game Parts — findmygame.parts")).toBe(true);
  });

  it("adds no extra blank lines when the footer is unset", async () => {
    await sendOrderResponseEmail({
      to: "buyer@example.com",
      gameTitle: "Fate of the Fellowship",
      items: [
        { partDescription: "Rohan Stealth card", quantityRequested: 1, status: "AVAILABLE", price: "5.00" },
      ],
    });

    const message = messageFrom(0);
    expect(message.TextPart.endsWith("Each claim holds for 5 days from now.")).toBe(true);
  });

  it("returns sent:false and logs without calling Mailjet when the send request rejects", async () => {
    request.mockRejectedValue(new Error("network error"));
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

  it("returns sent:false without calling Mailjet when the API keys are unset", async () => {
    vi.resetModules();
    delete process.env.MJ_APIKEY_PUBLIC;
    delete process.env.MJ_APIKEY_PRIVATE;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { sendOrderResponseEmail: sendWithoutKeys } = await import("./email");
    const { sent } = await sendWithoutKeys({
      to: "buyer@example.com",
      gameTitle: "Fate of the Fellowship",
      items: [
        { partDescription: "Rohan Stealth card", quantityRequested: 1, status: "AVAILABLE", price: "5.00" },
      ],
    });

    expect(sent).toBe(false);
    expect(request).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    process.env.MJ_APIKEY_PUBLIC = "test-public-key";
    process.env.MJ_APIKEY_PRIVATE = "test-private-key";
  });
});
