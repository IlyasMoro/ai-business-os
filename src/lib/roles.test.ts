import { describe, it, expect } from "vitest";
import { hasRole } from "@/lib/roles";

describe("hasRole", () => {
  it("returns true when the session role is in the allowed list", () => {
    expect(hasRole({ role: "ADMIN" }, ["OWNER", "ADMIN"])).toBe(true);
    expect(hasRole({ role: "OWNER" }, ["OWNER", "ADMIN"])).toBe(true);
  });

  it("returns false when the session role is not in the allowed list", () => {
    expect(hasRole({ role: "EMPLOYEE" }, ["OWNER", "ADMIN"])).toBe(false);
  });

  it("returns false for an empty allowed list", () => {
    expect(hasRole({ role: "OWNER" }, [])).toBe(false);
  });
});
