import { describe, it, expect } from "vitest";
import { RegisterSchema, LoginSchema } from "@/lib/validation/auth";

describe("RegisterSchema", () => {
  it("accepts valid registration data", () => {
    const result = RegisterSchema.safeParse({
      companyName: "Acme Co",
      name: "Jane Doe",
      email: "jane@acme.com",
      password: "supersecret1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a company name shorter than 2 characters", () => {
    expect(
      RegisterSchema.safeParse({
        companyName: "A",
        name: "Jane Doe",
        email: "jane@acme.com",
        password: "supersecret1",
      }).success
    ).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(
      RegisterSchema.safeParse({
        companyName: "Acme Co",
        name: "Jane Doe",
        email: "not-an-email",
        password: "supersecret1",
      }).success
    ).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const result = RegisterSchema.safeParse({
      companyName: "Acme Co",
      name: "Jane Doe",
      email: "Jane@Acme.COM",
      password: "supersecret1",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("jane@acme.com");
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      RegisterSchema.safeParse({
        companyName: "Acme Co",
        name: "Jane Doe",
        email: "jane@acme.com",
        password: "short",
      }).success
    ).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("accepts valid login data", () => {
    expect(
      LoginSchema.safeParse({ email: "jane@acme.com", password: "anything" }).success
    ).toBe(true);
  });

  it("rejects a missing password", () => {
    expect(LoginSchema.safeParse({ email: "jane@acme.com", password: "" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(LoginSchema.safeParse({ email: "nope", password: "anything" }).success).toBe(false);
  });

  it("normalizes email to lowercase so login isn't case-sensitive", () => {
    const result = LoginSchema.safeParse({ email: "Jane@ACME.com", password: "anything" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("jane@acme.com");
  });
});
