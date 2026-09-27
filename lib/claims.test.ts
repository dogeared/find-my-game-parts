import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const update = vi.fn();

vi.mock("./prisma", () => ({
  prisma: {
    partRequest: {
      findMany: (...args: unknown[]) => findMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import { expireStaleClaims } from "./claims";

describe("expireStaleClaims", () => {
  beforeEach(() => {
    findMany.mockReset();
    update.mockReset();
  });

  it("resets expired AVAILABLE claims back to PENDING (5-day window, outside-voice finding #5)", async () => {
    findMany.mockResolvedValue([{ id: "req-1" }, { id: "req-2" }]);
    update.mockResolvedValue({});

    const count = await expireStaleClaims();

    expect(count).toBe(2);
    expect(findMany).toHaveBeenCalledWith({
      where: { status: "AVAILABLE", claimedAt: { lt: expect.any(Date) } },
    });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { status: "PENDING", claimedAt: null, price: null },
    });
  });

  it("does nothing when there are no expired claims", async () => {
    findMany.mockResolvedValue([]);

    const count = await expireStaleClaims();

    expect(count).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it("uses a cutoff roughly 5 days in the past", async () => {
    findMany.mockResolvedValue([]);
    const before = Date.now();

    await expireStaleClaims();

    const cutoff = findMany.mock.calls[0][0].where.claimedAt.lt as Date;
    const expectedMs = before - 5 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expectedMs)).toBeLessThan(5000);
  });
});
