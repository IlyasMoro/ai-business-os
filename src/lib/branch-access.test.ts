import { describe, expect, it } from "vitest";
import {
  branchFilter,
  branchForNewRecord,
  canAccessRecord,
  effectiveLockedBranch,
  resolveBranchScope,
  type BranchOption,
} from "./branch-access";

const main: BranchOption = { id: "main", name: "Main branch", code: "MAIN", isMain: true, active: true };
const cpt: BranchOption = { id: "cpt", name: "Cape Town", code: "CPT", isMain: false, active: true };
const old: BranchOption = { id: "old", name: "Old shop", code: "OLD", isMain: false, active: false };
const branches = [main, cpt, old];

describe("effectiveLockedBranch", () => {
  it("never locks owners or admins, even with a branch set", () => {
    expect(effectiveLockedBranch("OWNER", "cpt", branches)).toBeNull();
    expect(effectiveLockedBranch("ADMIN", "cpt", branches)).toBeNull();
  });

  it("locks an employee to their branch", () => {
    expect(effectiveLockedBranch("EMPLOYEE", "cpt", branches)).toBe("cpt");
  });

  it("leaves an employee without a branch unlocked", () => {
    expect(effectiveLockedBranch("EMPLOYEE", null, branches)).toBeNull();
  });

  it("fails closed to the main branch when the locked branch no longer exists", () => {
    expect(effectiveLockedBranch("EMPLOYEE", "gone", branches)).toBe("main");
  });
});

describe("resolveBranchScope", () => {
  it("shows all branches when nothing is picked", () => {
    expect(resolveBranchScope({ role: "OWNER", userBranchId: null, selectedBranchId: null, branches })).toEqual({
      lockedBranchId: null,
      viewBranchId: null,
    });
  });

  it("uses the switcher's pick for owners and admins", () => {
    expect(resolveBranchScope({ role: "ADMIN", userBranchId: null, selectedBranchId: "cpt", branches }).viewBranchId).toBe("cpt");
  });

  it("ignores a stale or foreign pick", () => {
    expect(resolveBranchScope({ role: "OWNER", userBranchId: null, selectedBranchId: "other-company", branches }).viewBranchId).toBeNull();
  });

  it("forces a locked employee's view to their branch whatever the switcher says", () => {
    expect(resolveBranchScope({ role: "EMPLOYEE", userBranchId: "cpt", selectedBranchId: "main", branches })).toEqual({
      lockedBranchId: "cpt",
      viewBranchId: "cpt",
    });
  });
});

describe("branchFilter and canAccessRecord", () => {
  it("filters nothing for all branches, and by id for one branch", () => {
    expect(branchFilter({ lockedBranchId: null, viewBranchId: null })).toEqual({});
    expect(branchFilter({ lockedBranchId: null, viewBranchId: "cpt" })).toEqual({ branchId: "cpt" });
  });

  it("lets unlocked users open any record", () => {
    expect(canAccessRecord({ lockedBranchId: null, viewBranchId: "cpt" }, "main")).toBe(true);
  });

  it("blocks locked users from other branches' records, including unassigned ones", () => {
    const scope = { lockedBranchId: "cpt", viewBranchId: "cpt" };
    expect(canAccessRecord(scope, "cpt")).toBe(true);
    expect(canAccessRecord(scope, "main")).toBe(false);
    expect(canAccessRecord(scope, null)).toBe(false);
  });
});

describe("branchForNewRecord", () => {
  it("always uses a locked employee's branch, ignoring the form", () => {
    expect(branchForNewRecord({ lockedBranchId: "cpt", viewBranchId: "cpt" }, "main", branches)).toBe("cpt");
  });

  it("uses the form's choice when it is an active branch", () => {
    expect(branchForNewRecord({ lockedBranchId: null, viewBranchId: null }, "cpt", branches)).toBe("cpt");
  });

  it("rejects an inactive or unknown choice and falls back to the branch in view, then main", () => {
    expect(branchForNewRecord({ lockedBranchId: null, viewBranchId: "cpt" }, "old", branches)).toBe("cpt");
    expect(branchForNewRecord({ lockedBranchId: null, viewBranchId: null }, "nope", branches)).toBe("main");
  });
});
