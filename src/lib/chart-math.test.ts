import { describe, it, expect } from "vitest";
import { compactNumber, fullNumber, niceMax, periodChange, sharePct } from "@/lib/chart-math";

describe("niceMax", () => {
  it("rounds up to 1, 2, 2.5 or 5 of a power of ten", () => {
    expect(niceMax(60)).toBe(100);
    expect(niceMax(42)).toBe(50);
    expect(niceMax(18)).toBe(20);
    expect(niceMax(2.1)).toBe(2.5);
    expect(niceMax(1200)).toBe(2000);
    expect(niceMax(100)).toBe(100);
  });
  it("gives a usable axis for empty or zero data", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
  });
});

describe("periodChange", () => {
  it("compares the last value with the one before it", () => {
    expect(periodChange([10, 50, 75])).toEqual({ kind: "pct", pct: 50, direction: "up" });
    expect(periodChange([80, 60])).toEqual({ kind: "pct", pct: -25, direction: "down" });
    expect(periodChange([5, 5])).toEqual({ kind: "pct", pct: 0, direction: "flat" });
  });
  it("says 'from zero' instead of an infinite percent", () => {
    expect(periodChange([0, 0, 60])).toEqual({ kind: "from-zero" });
  });
  it("has nothing to say with one value, or zero after zero", () => {
    expect(periodChange([60])).toEqual({ kind: "none" });
    expect(periodChange([0, 0])).toEqual({ kind: "none" });
  });
});

describe("compactNumber", () => {
  it("shortens thousands and millions", () => {
    expect(compactNumber(950)).toBe("950");
    expect(compactNumber(1200, true)).toBe("$1.2k");
    expect(compactNumber(25_000, true)).toBe("$25k");
    expect(compactNumber(3_400_000)).toBe("3.4M");
    expect(compactNumber(-1500, true)).toBe("-$1.5k");
  });
});

describe("fullNumber and sharePct", () => {
  it("formats tooltips and shares", () => {
    expect(fullNumber(60, true)).toBe("$60.00");
    expect(fullNumber(1234)).toBe("1,234");
    expect(sharePct(1, 3)).toBe("33%");
    expect(sharePct(1, 500)).toBe("<1%");
    expect(sharePct(0, 5)).toBe("0%");
  });
});
