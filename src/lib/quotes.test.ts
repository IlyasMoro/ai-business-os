import { describe, expect, it } from "vitest";
import { acceptBlocker, displayStatus, isEditable, nextQuoteNumber, quoteTotal } from "@/lib/quotes";

const now = new Date("2026-10-04T12:00:00Z");

describe("quote status", () => {
  it("shows a sent quote as expired only after its valid until day ends", () => {
    expect(displayStatus({ status: "SENT", validUntil: new Date("2026-10-04T00:00:00Z") }, now)).toBe("SENT");
    expect(displayStatus({ status: "SENT", validUntil: new Date("2026-10-03T00:00:00Z") }, now)).toBe("EXPIRED");
    expect(displayStatus({ status: "SENT", validUntil: null }, now)).toBe("SENT");
  });

  it("never marks drafts or decided quotes as expired", () => {
    const old = new Date("2026-01-01T00:00:00Z");
    expect(displayStatus({ status: "DRAFT", validUntil: old }, now)).toBe("DRAFT");
    expect(displayStatus({ status: "ACCEPTED", validUntil: old }, now)).toBe("ACCEPTED");
  });

  it("locks quotes once decided", () => {
    expect(isEditable("DRAFT")).toBe(true);
    expect(isEditable("SENT")).toBe(true);
    expect(isEditable("ACCEPTED")).toBe(false);
    expect(isEditable("DECLINED")).toBe(false);
  });
});

describe("acceptBlocker", () => {
  const valid = new Date("2026-11-01T00:00:00Z");
  it("allows a sent or draft quote with items", () => {
    expect(acceptBlocker({ status: "SENT", validUntil: valid, itemCount: 2 }, now)).toBeNull();
    expect(acceptBlocker({ status: "DRAFT", validUntil: null, itemCount: 1 }, now)).toBeNull();
  });
  it("blocks empty, expired and decided quotes", () => {
    expect(acceptBlocker({ status: "SENT", validUntil: valid, itemCount: 0 }, now)).toMatch(/at least one/);
    expect(acceptBlocker({ status: "SENT", validUntil: new Date("2026-09-01T00:00:00Z"), itemCount: 1 }, now)).toMatch(/expired/);
    expect(acceptBlocker({ status: "ACCEPTED", validUntil: valid, itemCount: 1 }, now)).toMatch(/already/);
    expect(acceptBlocker({ status: "DECLINED", validUntil: valid, itemCount: 1 }, now)).toMatch(/declined/);
  });
});

describe("quote numbers and totals", () => {
  it("continues from the highest number, ignoring gaps and odd ones", () => {
    expect(nextQuoteNumber([])).toBe("Q0001");
    expect(nextQuoteNumber(["Q0001", "Q-0007", "Q0003", "OLD-9"])).toBe("Q0008");
    expect(nextQuoteNumber(["Q-9999"])).toBe("Q10000");
  });

  it("adds up lines to the cent", () => {
    expect(quoteTotal([{ quantity: 3, unitPrice: 19.99 }, { quantity: 1, unitPrice: 0.1 }])).toBe(60.07);
    expect(quoteTotal([])).toBe(0);
  });
});
