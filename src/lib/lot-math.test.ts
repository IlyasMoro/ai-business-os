import { describe, it, expect } from "vitest";
import { generateSerials, isExpired, isExpiringSoon, isValidTrackingCode, parseSerials, pickLots, type StockLot } from "@/lib/lot-math";

const today = new Date("2026-09-24T12:00:00Z");
const lot = (lotNumber: string, quantity: number, received: string, expires: string | null): StockLot => ({
  id: lotNumber,
  lotNumber,
  quantity,
  receivedAt: new Date(received),
  expiresAt: expires ? new Date(expires) : null,
});

const lots = [
  lot("OLD", 5, "2026-01-01", "2026-12-31"),
  lot("SOON", 5, "2026-06-01", "2026-10-01"),
  lot("NOEXP", 5, "2026-03-01", null),
  lot("GONE", 5, "2025-12-01", "2026-09-01"),
];

describe("pickLots", () => {
  it("FIFO takes the oldest receipt first", () => {
    const { allocations } = pickLots(lots, 7, { rule: "FIFO", blockExpired: false, today });
    expect(allocations).toEqual([
      { lotId: "GONE", lotNumber: "GONE", quantity: 5 },
      { lotId: "OLD", lotNumber: "OLD", quantity: 2 },
    ]);
  });

  it("FEFO takes the earliest expiry first, lots without expiry last", () => {
    const { allocations } = pickLots(lots, 12, { rule: "FEFO", blockExpired: false, today });
    expect(allocations.map((a) => a.lotNumber)).toEqual(["GONE", "SOON", "OLD"]);
  });

  it("skips expired lots when they're blocked", () => {
    const { allocations } = pickLots(lots, 6, { rule: "FEFO", blockExpired: true, today });
    expect(allocations).toEqual([
      { lotId: "SOON", lotNumber: "SOON", quantity: 5 },
      { lotId: "OLD", lotNumber: "OLD", quantity: 1 },
    ]);
  });

  it("reports a shortfall when lots run out", () => {
    const result = pickLots(lots, 30, { rule: "FIFO", blockExpired: true, today });
    expect(result.shortfall).toBe(15);
  });

  it("ignores empty lots", () => {
    expect(pickLots([lot("EMPTY", 0, "2026-01-01", null)], 1, { rule: "FIFO", blockExpired: false, today }).shortfall).toBe(1);
  });
});

describe("expiry", () => {
  it("treats a lot as expired only after its expiry day", () => {
    expect(isExpired({ expiresAt: new Date("2026-09-24") }, today)).toBe(false);
    expect(isExpired({ expiresAt: new Date("2026-09-23") }, today)).toBe(true);
    expect(isExpired({ expiresAt: null }, today)).toBe(false);
  });

  it("warns within the configured number of days", () => {
    expect(isExpiringSoon({ expiresAt: new Date("2026-10-01") }, 14, today)).toBe(true);
    expect(isExpiringSoon({ expiresAt: new Date("2026-12-01") }, 14, today)).toBe(false);
    expect(isExpiringSoon({ expiresAt: new Date("2026-09-01") }, 14, today)).toBe(false);
  });
});

describe("serials", () => {
  it("accepts one per unit, split by lines or commas", () => {
    expect(parseSerials("SN1\nSN2, SN3", 3)).toEqual({ serials: ["SN1", "SN2", "SN3"], error: null });
  });

  it("rejects the wrong count, repeats and odd characters", () => {
    expect(parseSerials("SN1\nSN2", 3).error).toMatch(/exactly 3/);
    expect(parseSerials("SN1\nSN1", 2).error).toMatch(/listed twice/);
    expect(parseSerials("SN1\n<b>", 2).error).toMatch(/isn't a valid/);
  });

  it("generates padded serials for built units", () => {
    expect(generateSerials("WO0007", 2)).toEqual(["WO0007S001", "WO0007S002"]);
  });

  it("validates codes", () => {
    expect(isValidTrackingCode("LOT 2026/09")).toBe(true);
    expect(isValidTrackingCode("")).toBe(false);
    expect(isValidTrackingCode(" padded")).toBe(false);
  });
});
