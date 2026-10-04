/* Stock adjustments and history labels, shared by the product actions, the
   product page and tests. No database access here. */

export type StockMovementKind =
  | "OPENING"
  | "ADJUSTMENT"
  | "RECEIPT"
  | "SALE"
  | "SALE_CANCELLED"
  | "RETURN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "PRODUCTION"
  | "CONSUMPTION";

export type StockAdjustmentReason = "COUNT" | "DAMAGED" | "LOST" | "FOUND" | "OTHER";

export const MOVEMENT_KIND_LABEL: Record<StockMovementKind, string> = {
  OPENING: "Opening stock",
  ADJUSTMENT: "Adjustment",
  RECEIPT: "Received",
  SALE: "Sold",
  SALE_CANCELLED: "Sale cancelled",
  RETURN: "Returned",
  TRANSFER_OUT: "Sent to branch",
  TRANSFER_IN: "Arrived from branch",
  PRODUCTION: "Built",
  CONSUMPTION: "Used in a build",
};

export const ADJUSTMENT_REASONS: { id: StockAdjustmentReason; label: string }[] = [
  { id: "COUNT", label: "Stock count correction" },
  { id: "DAMAGED", label: "Damaged" },
  { id: "LOST", label: "Lost or stolen" },
  { id: "FOUND", label: "Found" },
  { id: "OTHER", label: "Other" },
];

export const ADJUSTMENT_REASON_IDS = ADJUSTMENT_REASONS.map((r) => r.id);

export function reasonLabel(reason: StockAdjustmentReason | null | undefined): string | null {
  return reason ? (ADJUSTMENT_REASONS.find((r) => r.id === reason)?.label ?? null) : null;
}

/**
 * Turns the adjust form into a change. "count" sets the branch to the
 * counted quantity; "change" adds (or with a minus, takes) that many.
 * Damaged and lost can only take stock away, found can only add.
 */
export function planAdjustment(input: {
  mode: "count" | "change";
  value: number;
  current: number;
  reason: StockAdjustmentReason;
}): { delta: number } | { error: string } {
  if (!Number.isInteger(input.value)) return { error: "Enter a whole number." };
  const delta = input.mode === "count" ? input.value - input.current : input.value;
  if (input.mode === "count" && input.value < 0) return { error: "A counted quantity can't be negative." };
  if (delta === 0) return { error: input.mode === "count" ? "That matches the stock on hand already." : "Enter a change other than zero." };
  if (input.current + delta < 0) return { error: `That would leave ${input.current + delta} in stock. There are only ${input.current} here.` };
  if ((input.reason === "DAMAGED" || input.reason === "LOST") && delta > 0) return { error: "Damaged or lost stock can only go down." };
  if (input.reason === "FOUND" && delta < 0) return { error: "Found stock can only go up." };
  return { delta };
}

/** Why a product can't be deleted, or null when it can. */
export function productDeleteBlocker(uses: {
  orders: boolean;
  quotes: boolean;
  deals: boolean;
  purchaseOrders: boolean;
  returns: boolean;
  workOrders: boolean;
  billsOfMaterials: boolean;
  transfers: boolean;
  lots: boolean;
}): string | null {
  const names: [keyof typeof uses, string][] = [
    ["orders", "sales orders"],
    ["quotes", "quotes"],
    ["deals", "deals"],
    ["purchaseOrders", "purchase orders"],
    ["returns", "returns"],
    ["workOrders", "work orders"],
    ["billsOfMaterials", "other products' parts lists"],
    ["transfers", "stock transfers"],
    ["lots", "stock lots"],
  ];
  const found = names.filter(([key]) => uses[key]).map(([, name]) => name);
  if (found.length === 0) return null;
  const list = found.length === 1 ? found[0] : `${found.slice(0, -1).join(", ")} and ${found[found.length - 1]}`;
  return `This product is used in ${list}, so it can't be deleted without breaking their history.`;
}
