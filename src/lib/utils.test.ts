import { describe, it, expect } from "vitest";
import {
  cn,
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  toDateInputValue,
  dateInputDaysFromNow,
  formatFileSize,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-slate-900", undefined, "font-bold")).toBe("text-slate-900 font-bold");
  });
});

describe("formatCurrency", () => {
  it("formats a number as USD currency", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

describe("formatCompactCurrency", () => {
  it("formats large numbers compactly", () => {
    expect(formatCompactCurrency(1500)).toBe("$1.5K");
    expect(formatCompactCurrency(4200000)).toBe("$4.2M");
  });

  it("formats small numbers plainly, with no trailing decimal", () => {
    expect(formatCompactCurrency(0)).toBe("$0");
    expect(formatCompactCurrency(42)).toBe("$42");
  });
});

describe("formatDate", () => {
  it("formats a date in a readable form", () => {
    expect(formatDate("2026-01-15")).toBe("Jan 15, 2026");
  });
});

describe("toDateInputValue", () => {
  it("returns an ISO yyyy-mm-dd string", () => {
    expect(toDateInputValue(new Date("2026-03-05T12:00:00Z"))).toBe("2026-03-05");
  });
});

describe("dateInputDaysFromNow", () => {
  it("offsets from today by the given number of days", () => {
    const today = toDateInputValue(new Date());
    expect(dateInputDaysFromNow(0)).toBe(today);

    const expected = toDateInputValue(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
    expect(dateInputDaysFromNow(5)).toBe(expected);
  });
});

describe("formatFileSize", () => {
  it("formats bytes plainly under 1KB", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobytes with one decimal place", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(2560)).toBe("2.5 KB");
  });

  it("formats megabytes with one decimal place", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(8 * 1024 * 1024)).toBe("8.0 MB");
  });
});
