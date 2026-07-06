import { describe, it, expect } from "vitest";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";

describe("PAGE_SIZE", () => {
  it("is a positive integer", () => {
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });
});

describe("parsePage", () => {
  it("defaults to 1 when undefined", () => {
    expect(parsePage(undefined)).toBe(1);
  });

  it("defaults to 1 for non-numeric input", () => {
    expect(parsePage("abc")).toBe(1);
  });

  it("defaults to 1 for zero or negative input", () => {
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-5")).toBe(1);
  });

  it("floors fractional values", () => {
    expect(parsePage("3.7")).toBe(3);
  });

  it("parses valid positive integers", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage("42")).toBe(42);
  });
});
