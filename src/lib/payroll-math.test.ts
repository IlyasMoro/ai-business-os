import { describe, it, expect } from "vitest";
import { computeNetPay, computePayrollRunTotal } from "@/lib/payroll-math";

describe("computeNetPay", () => {
  it("subtracts deductions from gross pay", () => {
    expect(computeNetPay(5000, 750)).toBe(4250);
  });

  it("returns the full gross pay when deductions are zero", () => {
    expect(computeNetPay(5000, 0)).toBe(5000);
  });

  it("handles deductions equal to gross pay", () => {
    expect(computeNetPay(1000, 1000)).toBe(0);
  });
});

describe("computePayrollRunTotal", () => {
  it("returns 0 for an empty list", () => {
    expect(computePayrollRunTotal([])).toBe(0);
  });

  it("sums net pay across payroll items", () => {
    expect(
      computePayrollRunTotal([{ netPay: 4250 }, { netPay: 3800 }, { netPay: 5000 }])
    ).toBe(13050);
  });

  it("handles a single item", () => {
    expect(computePayrollRunTotal([{ netPay: 4250 }])).toBe(4250);
  });
});
