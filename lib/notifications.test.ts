import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const sendOrderResponseEmail = vi.fn();

vi.mock("./prisma", () => ({
  prisma: { partOrder: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

vi.mock("./email", () => ({
  sendOrderResponseEmail: (...args: unknown[]) => sendOrderResponseEmail(...args),
}));

import { notifyOrder } from "./notifications";

describe("notifyOrder", () => {
  beforeEach(() => {
    findUnique.mockReset();
    sendOrderResponseEmail.mockReset();
  });

  it("returns sent:false without emailing when the order doesn't exist", async () => {
    findUnique.mockResolvedValue(null);

    const result = await notifyOrder("missing-id");

    expect(result).toEqual({ sent: false });
    expect(sendOrderResponseEmail).not.toHaveBeenCalled();
  });

  it("fetches the order and sends a summary of its current item states", async () => {
    findUnique.mockResolvedValue({
      id: "order-1",
      game: { title: "Fate of the Fellowship" },
      requester: { email: "buyer@example.com" },
      items: [
        {
          partDescription: "Rohan Stealth card",
          quantityRequested: 1,
          status: "AVAILABLE",
          quantityAvailable: 1,
          price: { toString: () => "5.00" },
        },
        {
          partDescription: "Shadow Warrior meeple",
          quantityRequested: 10,
          status: "PENDING",
          quantityAvailable: null,
          price: null,
        },
      ],
    });
    sendOrderResponseEmail.mockResolvedValue({ sent: true });

    const result = await notifyOrder("order-1");

    expect(result).toEqual({ sent: true });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "order-1" },
      include: { game: true, requester: true, items: { orderBy: { createdAt: "asc" } } },
    });
    expect(sendOrderResponseEmail).toHaveBeenCalledWith({
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
        {
          partDescription: "Shadow Warrior meeple",
          quantityRequested: 10,
          status: "PENDING",
          quantityAvailable: null,
          price: null,
        },
      ],
    });
  });

  it("propagates sent:false when the underlying email send fails", async () => {
    findUnique.mockResolvedValue({
      id: "order-1",
      game: { title: "Fate of the Fellowship" },
      requester: { email: "buyer@example.com" },
      items: [],
    });
    sendOrderResponseEmail.mockResolvedValue({ sent: false });

    const result = await notifyOrder("order-1");

    expect(result).toEqual({ sent: false });
  });
});
