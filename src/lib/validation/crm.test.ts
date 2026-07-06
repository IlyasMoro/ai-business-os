import { describe, it, expect } from "vitest";
import { CustomerSchema, ContactSchema } from "@/lib/validation/crm";

describe("CustomerSchema", () => {
  it("accepts a valid customer", () => {
    const result = CustomerSchema.safeParse({
      name: "Acme Co",
      email: "hello@acme.com",
      phone: "555-1234",
      company: "Acme Inc",
      status: "LEAD",
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = CustomerSchema.safeParse({
      name: "",
      status: "LEAD",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email but allows an empty string", () => {
    expect(
      CustomerSchema.safeParse({ name: "Acme", status: "LEAD", email: "not-an-email" }).success
    ).toBe(false);
    expect(
      CustomerSchema.safeParse({ name: "Acme", status: "LEAD", email: "" }).success
    ).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = CustomerSchema.safeParse({ name: "Acme", status: "BOGUS" });
    expect(result.success).toBe(false);
  });
});

describe("ContactSchema", () => {
  it("accepts a valid contact", () => {
    const result = ContactSchema.safeParse({
      name: "Jane Doe",
      email: "jane@acme.com",
      phone: "555-5678",
      role: "Procurement",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = ContactSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
