import { describe, expect, it } from "vitest";
import { cleanAccess, decideAccess, moduleOfPath, MANAGER_MODULES, PRESET_ROLES } from "@/lib/role-access";

describe("moduleOfPath", () => {
  it("finds the module from the first part after /dashboard/", () => {
    expect(moduleOfPath("/dashboard/sales")).toBe("sales");
    expect(moduleOfPath("/dashboard/sales/abc123")).toBe("sales");
    expect(moduleOfPath("/dashboard/reports/branches")).toBe("reports");
  });

  it("leaves pages every member may open outside any module", () => {
    expect(moduleOfPath("/dashboard")).toBeNull();
    expect(moduleOfPath("/dashboard/account")).toBeNull();
    expect(moduleOfPath("/dashboard/billing")).toBeNull();
    expect(moduleOfPath(null)).toBeNull();
    expect(moduleOfPath("/login")).toBeNull();
  });
});

describe("decideAccess", () => {
  const cashier = { sales: "full", crm: "view" } as const;

  it("allows full modules for viewing and saving", () => {
    expect(decideAccess(cashier, "/dashboard/sales/new", false)).toBe("allow");
    expect(decideAccess(cashier, "/dashboard/sales/new", true)).toBe("allow");
  });

  it("allows view modules for looking but not for saving", () => {
    expect(decideAccess(cashier, "/dashboard/crm", false)).toBe("allow");
    expect(decideAccess(cashier, "/dashboard/crm/abc", true)).toBe("view-only");
  });

  it("refuses modules the role doesn't have", () => {
    expect(decideAccess(cashier, "/dashboard/payroll", false)).toBe("no-access");
    expect(decideAccess(cashier, "/dashboard/inventory", true)).toBe("no-access");
  });

  it("always allows the dashboard and the member's own account", () => {
    expect(decideAccess({}, "/dashboard", true)).toBe("allow");
    expect(decideAccess({}, "/dashboard/account", true)).toBe("allow");
  });
});

describe("cleanAccess", () => {
  it("drops unknown modules and bad levels", () => {
    expect(cleanAccess({ sales: "full", nonsense: "full", crm: "edit" }, "ADMIN")).toEqual({ sales: "full" });
  });

  it("never gives manager modules to a role built on Employee", () => {
    expect(cleanAccess({ sales: "full", payroll: "full", settings: "view" }, "EMPLOYEE")).toEqual({ sales: "full" });
    expect(cleanAccess({ payroll: "full" }, "ADMIN")).toEqual({ payroll: "full" });
  });

  it("handles a missing value", () => {
    expect(cleanAccess(null, "ADMIN")).toEqual({});
  });
});

describe("PRESET_ROLES", () => {
  it("only gives manager modules to roles built on Admin", () => {
    for (const role of PRESET_ROLES) {
      if (role.baseRole === "ADMIN") continue;
      expect(Object.keys(role.access).filter((k) => MANAGER_MODULES.has(k as never))).toEqual([]);
    }
  });

  it("keeps the cashier away from money and settings", () => {
    const cashier = PRESET_ROLES.find((r) => r.preset === "CASHIER")!;
    for (const key of ["accounting", "payroll", "hr", "settings", "team", "reports"] as const) {
      expect(cashier.access[key]).toBeUndefined();
    }
  });

  it("uses no hyphens or dashes in names and descriptions", () => {
    for (const role of PRESET_ROLES) expect(`${role.name} ${role.description}`).not.toMatch(/[—–-]/);
  });
});
