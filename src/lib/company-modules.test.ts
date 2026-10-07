import { describe, it, expect } from "vitest";
import { cleanDisabledModules, isModuleOff, SWITCHABLE_MODULES } from "@/lib/company-modules";
import { canOpenModule } from "@/lib/role-access";

describe("company modules", () => {
  it("keeps only modules that can be switched off, once each", () => {
    expect(cleanDisabledModules(["marketing", "crm", "marketing", "nonsense", "edi"])).toEqual(["marketing", "edi"]);
    expect(cleanDisabledModules(null)).toEqual([]);
  });

  it("never offers the core modules or settings as a switch", () => {
    const keys = SWITCHABLE_MODULES.map((m) => m.key as string);
    for (const core of ["crm", "sales", "invoicing", "inventory", "settings", "team", "branches"]) expect(keys).not.toContain(core);
  });

  it("closes every page of a switched off module, and nothing else", () => {
    expect(isModuleOff(["quotes"], "/dashboard/quotes")).toBe(true);
    expect(isModuleOff(["quotes"], "/dashboard/quotes/abc/edit")).toBe(true);
    expect(isModuleOff(["quotes"], "/dashboard/sales")).toBe(false);
    expect(isModuleOff(["quotes"], "/dashboard")).toBe(false);
    expect(isModuleOff(["quotes"], null)).toBe(false);
  });

  it("has user facing text without hyphens or dashes", () => {
    for (const m of SWITCHABLE_MODULES) expect(`${m.label} ${m.description} ${m.section}`).not.toMatch(/[—–-]/);
  });
});

describe("canOpenModule", () => {
  it("lets owners open everything the company has switched on", () => {
    expect(canOpenModule({ role: "OWNER", access: null }, "payroll")).toBe(true);
    expect(canOpenModule({ role: "OWNER", access: null, disabledModules: ["payroll"] }, "payroll")).toBe(false);
  });

  it("keeps plain employees out of the manager modules", () => {
    expect(canOpenModule({ role: "EMPLOYEE", access: null }, "sales")).toBe(true);
    expect(canOpenModule({ role: "EMPLOYEE", access: null }, "accounting")).toBe(false);
    expect(canOpenModule({ role: "ADMIN", access: null }, "accounting")).toBe(true);
  });

  it("follows a company role's list exactly", () => {
    const cashier = { role: "EMPLOYEE" as const, access: { sales: "full" as const, inventory: "view" as const } };
    expect(canOpenModule(cashier, "sales")).toBe(true);
    expect(canOpenModule(cashier, "inventory")).toBe(true);
    expect(canOpenModule(cashier, "invoicing")).toBe(false);
    expect(canOpenModule(cashier, "reports")).toBe(false);
  });
});
