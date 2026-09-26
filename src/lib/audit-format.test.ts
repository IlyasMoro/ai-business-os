import { describe, it, expect } from "vitest";
import { auditHref, formatAuditAction, formatAuditDetails } from "@/lib/audit-format";

const names = new Map([
  ["cmmain", "Main branch"],
  ["cmcpt", "Cape Town"],
]);

describe("formatAuditAction", () => {
  it("reads dotted and underscored actions as a sentence", () => {
    expect(formatAuditAction("transfer.approved_and_sent")).toBe("Transfer approved and sent");
    expect(formatAuditAction("branch.created")).toBe("Branch created");
  });
});

describe("formatAuditDetails", () => {
  it("turns a route of IDs into branch names", () => {
    expect(formatAuditDetails(JSON.stringify({ from: "cmmain", to: "cmcpt" }), names)).toBe("From Main branch to Cape Town");
  });
  it("labels keys and tidies enum values", () => {
    expect(formatAuditDetails(JSON.stringify({ from: "NONE", to: "LOT" }))).toBe("From none to lot");
    expect(formatAuditDetails(JSON.stringify({ lines: 1 }))).toBe("Lines: 1");
    expect(formatAuditDetails(JSON.stringify({ code: "CPT" }))).toBe("Code: CPT");
    expect(formatAuditDetails(JSON.stringify({ fiscalYear: 2026, onHold: true }))).toBe("Fiscal year: 2026 · On hold: yes");
  });
  it("shows a branch by name, and a cleared branch as all branches", () => {
    expect(formatAuditDetails(JSON.stringify({ branchId: "cmcpt" }), names)).toBe("Branch: Cape Town");
    expect(formatAuditDetails(JSON.stringify({ branchId: null }), names)).toBe("Branch: all branches");
  });
  it("gives nothing for empty or broken metadata", () => {
    expect(formatAuditDetails(null)).toBeNull();
    expect(formatAuditDetails("{}")).toBeNull();
    expect(formatAuditDetails("not json")).toBeNull();
  });
});

describe("auditHref", () => {
  it("links records that have a page", () => {
    expect(auditHref("StockTransfer", "t1")).toBe("/dashboard/transfers/t1");
    expect(auditHref("Branch", "b1")).toBe("/dashboard/branches");
    expect(auditHref("User", "u1")).toBeNull();
  });
});
