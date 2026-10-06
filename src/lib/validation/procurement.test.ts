import { describe, it, expect } from "vitest";
import { SupplierSchema, PurchaseOrderSchema, PurchaseOrderItemSchema } from "@/lib/validation/procurement";

describe("SupplierSchema", () => {
  it("accepts a valid supplier", () => {
    const result = SupplierSchema.safeParse({
      name: "Acme Supply Co",
      email: "sales@acmesupply.com",
      phone: "555-1234",
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(SupplierSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects an invalid email but allows an empty string", () => {
    expect(SupplierSchema.safeParse({ name: "Acme", email: "not-an-email" }).success).toBe(false);
    expect(SupplierSchema.safeParse({ name: "Acme", email: "" }).success).toBe(true);
  });
});

describe("PurchaseOrderSchema", () => {
  it("accepts a valid supplierId", () => {
    expect(PurchaseOrderSchema.safeParse({ supplierId: "cust_123" }).success).toBe(true);
  });

  it("rejects a missing supplierId", () => {
    expect(PurchaseOrderSchema.safeParse({ supplierId: "" }).success).toBe(false);
  });
});

describe("PurchaseOrderItemSchema", () => {
  it("accepts a valid item", () => {
    const result = PurchaseOrderItemSchema.safeParse({
      productId: "prod_123",
      quantity: "10",
      unitCost: "4.50",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing productId", () => {
    expect(
      PurchaseOrderItemSchema.safeParse({ productId: "", quantity: "1", unitCost: "1" }).success
    ).toBe(false);
  });

  it("rejects zero and more than 3 decimals, accepts a weighed quantity", () => {
    expect(
      PurchaseOrderItemSchema.safeParse({ productId: "p1", quantity: "0", unitCost: "1" }).success
    ).toBe(false);
    expect(
      PurchaseOrderItemSchema.safeParse({ productId: "p1", quantity: "1.2345", unitCost: "1" }).success
    ).toBe(false);
    // 1.5 kg is valid here; a product counted by the piece is refused by
    // the action, which knows the product's unit (lib/quantity.ts).
    expect(
      PurchaseOrderItemSchema.safeParse({ productId: "p1", quantity: "1.5", unitCost: "1" }).success
    ).toBe(true);
  });

  it("rejects a negative unit cost but allows zero", () => {
    expect(
      PurchaseOrderItemSchema.safeParse({ productId: "p1", quantity: "1", unitCost: "-1" }).success
    ).toBe(false);
    expect(
      PurchaseOrderItemSchema.safeParse({ productId: "p1", quantity: "1", unitCost: "0" }).success
    ).toBe(true);
  });
});
