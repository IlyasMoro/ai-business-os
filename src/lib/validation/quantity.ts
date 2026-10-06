import * as z from "zod";
import { QTY_DECIMALS, roundQty } from "@/lib/quantity";

// Shared rules for quantity fields. The schemas accept up to 3 decimals so
// a weighed product (1.35 kg) passes; the server action then checks the
// product's own unit with quantityError(), which refuses decimals for
// products counted by the piece.

const atMostThreeDecimals = (value: number) => Math.abs(roundQty(value) - value) < 1e-9;
const decimalsMessage = `Use at most ${QTY_DECIMALS} decimals, for example 1.25.`;

/** A line quantity (order, quote, invoice, purchase order, return…): more than 0. */
export function lineQuantity() {
  return z.coerce
    .number({ error: "Enter a valid quantity." })
    .positive({ error: "Quantity must be more than 0." })
    .max(1_000_000, { error: "That quantity is too large." })
    .refine(atMostThreeDecimals, { error: decimalsMessage });
}

/** A stock level or reorder level: 0 or more. */
export function stockQuantity(label = "Quantity") {
  return z.coerce
    .number({ error: `Enter a valid ${label.toLowerCase()}.` })
    .min(0, { error: `${label} cannot be negative.` })
    .max(100_000_000, { error: `${label} is too large.` })
    .refine(atMostThreeDecimals, { error: decimalsMessage });
}
