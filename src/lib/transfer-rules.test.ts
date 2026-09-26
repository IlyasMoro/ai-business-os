import { describe, it, expect } from "vitest";
import {
  canActOnTransfer,
  canTransitionTransfer,
  formatTransferNumber,
  nextTransferSequence,
  planLotArrivals,
  transferRouteError,
} from "@/lib/transfer-rules";

describe("canTransitionTransfer", () => {
  it("follows draft, sent, received", () => {
    expect(canTransitionTransfer("DRAFT", "SENT")).toBe(true);
    expect(canTransitionTransfer("SENT", "RECEIVED")).toBe(true);
    expect(canTransitionTransfer("DRAFT", "CANCELLED")).toBe(true);
  });
  it("can't skip sending, cancel once sent, or reopen", () => {
    expect(canTransitionTransfer("DRAFT", "RECEIVED")).toBe(false);
    expect(canTransitionTransfer("SENT", "CANCELLED")).toBe(false);
    expect(canTransitionTransfer("RECEIVED", "SENT")).toBe(false);
    expect(canTransitionTransfer("CANCELLED", "DRAFT")).toBe(false);
  });
});

describe("canActOnTransfer", () => {
  const t = { fromBranchId: "north", toBranchId: "south" };
  it("lets unrestricted users do everything", () => {
    for (const a of ["view", "edit", "send", "cancel", "receive"] as const) {
      expect(canActOnTransfer(null, t, a)).toBe(true);
    }
  });
  it("the sending branch prepares and sends but can't receive", () => {
    expect(canActOnTransfer("north", t, "view")).toBe(true);
    expect(canActOnTransfer("north", t, "edit")).toBe(true);
    expect(canActOnTransfer("north", t, "send")).toBe(true);
    expect(canActOnTransfer("north", t, "cancel")).toBe(true);
    expect(canActOnTransfer("north", t, "receive")).toBe(false);
  });
  it("the receiving branch only views and receives", () => {
    expect(canActOnTransfer("south", t, "view")).toBe(true);
    expect(canActOnTransfer("south", t, "receive")).toBe(true);
    expect(canActOnTransfer("south", t, "send")).toBe(false);
    expect(canActOnTransfer("south", t, "edit")).toBe(false);
  });
  it("a third branch can't even see it", () => {
    expect(canActOnTransfer("east", t, "view")).toBe(false);
  });
});

describe("transferRouteError", () => {
  it("rejects a branch sending to itself and inactive branches", () => {
    expect(transferRouteError("a", "a", ["a", "b"])).toBe("transfer-same-branch");
    expect(transferRouteError("a", "c", ["a", "b"])).toBe("branch-inactive");
    expect(transferRouteError("a", "b", ["a", "b"])).toBeNull();
  });
});

describe("transfer numbers", () => {
  it("continue from the highest number used", () => {
    expect(nextTransferSequence([])).toBe(1);
    expect(nextTransferSequence(["TR-0002", "TR-0010", "junk"])).toBe(11);
    expect(formatTransferNumber(11)).toBe("TR-0011");
  });
});

describe("planLotArrivals", () => {
  it("adds up units per lot and keeps the lot's dates", () => {
    const received = new Date("2026-01-05");
    const expires = new Date("2026-12-31");
    const plan = planLotArrivals([
      { productId: "p", lotNumber: "L1", expiresAt: expires, receivedAt: received, source: "PO", quantity: -3 },
      { productId: "p", lotNumber: "L1", expiresAt: expires, receivedAt: received, source: "PO", quantity: -2 },
      { productId: "p", lotNumber: "L2", expiresAt: null, receivedAt: received, source: "WO", quantity: -1 },
    ]);
    expect(plan).toEqual([
      { productId: "p", lotNumber: "L1", expiresAt: expires, receivedAt: received, source: "PO", quantity: 5 },
      { productId: "p", lotNumber: "L2", expiresAt: null, receivedAt: received, source: "WO", quantity: 1 },
    ]);
  });
  it("keeps the same lot number of two products apart", () => {
    const d = new Date();
    const plan = planLotArrivals([
      { productId: "a", lotNumber: "L1", expiresAt: null, receivedAt: d, source: "PO", quantity: -1 },
      { productId: "b", lotNumber: "L1", expiresAt: null, receivedAt: d, source: "PO", quantity: -1 },
    ]);
    expect(plan).toHaveLength(2);
  });
});
