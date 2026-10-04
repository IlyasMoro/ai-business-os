/* Product cost after a purchase order is received. No database access here. */

export type CostMethod = "MANUAL" | "LAST_PRICE" | "AVERAGE";

export const COST_METHODS: { id: CostMethod; label: string; description: string }[] = [
  { id: "MANUAL", label: "Keep the cost I type", description: "Receiving stock never changes a product's cost." },
  { id: "LAST_PRICE", label: "Last price paid", description: "Cost becomes the unit cost on the latest purchase order received." },
  {
    id: "AVERAGE",
    label: "Moving average",
    description: "Cost becomes the average of the stock on hand and what just arrived, the usual choice for stock valuation.",
  },
];

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * The product's new cost. `lines` are this receipt's lines for the product
 * (a product can appear on more than one line); `onHand` is the company
 * total before the receipt. Stock below zero counts as none.
 */
export function costAfterReceipt(input: {
  method: CostMethod;
  currentCost: number;
  onHand: number;
  lines: { quantity: number; unitCost: number }[];
}): number {
  const received = input.lines.reduce((s, l) => s + l.quantity, 0);
  if (input.method === "MANUAL" || received <= 0) return input.currentCost;
  if (input.method === "LAST_PRICE") return input.lines[input.lines.length - 1].unitCost;
  const spent = input.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const onHand = Math.max(0, input.onHand);
  return round4((onHand * input.currentCost + spent) / (onHand + received));
}
