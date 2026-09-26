/* Pure stock per branch rules, free of database code so they can be unit
   tested. lib/stock.ts feeds them real rows. */

import { computeReorderQuantity, needsReorder } from "@/lib/automation-rules";

export type BranchStockRow = {
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  quantity: number;
  /** The branch's own reorder level, or null to use the product's. */
  reorderLevel: number | null;
  productReorderLevel: number;
};

export function effectiveReorderLevel(row: Pick<BranchStockRow, "reorderLevel" | "productReorderLevel">): number {
  return row.reorderLevel ?? row.productReorderLevel;
}

export function isLowAtBranch(row: Pick<BranchStockRow, "quantity" | "reorderLevel" | "productReorderLevel">): boolean {
  return needsReorder(row.quantity, effectiveReorderLevel(row));
}

/** Low rows, lowest cover first, so alerts lead with the most urgent. */
export function lowStockRows<T extends BranchStockRow>(rows: T[]): T[] {
  return rows
    .filter(isLowAtBranch)
    .sort((a, b) => a.quantity - effectiveReorderLevel(a) - (b.quantity - effectiveReorderLevel(b)));
}

/**
 * Groups low rows into one reorder per branch, as automations raise one
 * purchase order per branch that is short.
 */
export function reorderPlanByBranch(rows: BranchStockRow[]): Map<string, { productId: string; quantity: number }[]> {
  const plan = new Map<string, { productId: string; quantity: number }[]>();
  for (const row of lowStockRows(rows)) {
    const lines = plan.get(row.branchId) ?? [];
    lines.push({ productId: row.productId, quantity: computeReorderQuantity(row.quantity, effectiveReorderLevel(row)) });
    plan.set(row.branchId, lines);
  }
  return plan;
}

export type BranchShortfall = {
  productId: string;
  productName: string;
  requested: number;
  /** On hand at the branch the goods leave from. */
  available: number;
  /** On hand at every other branch together, to hint at a transfer. */
  elsewhere: number;
};

/** Lines a branch can't cover from its own stock. Negative stock is never allowed per branch. */
export function findBranchShortfalls(
  items: { productId: string; productName: string; quantity: number; branchQty: number; totalQty: number }[]
): BranchShortfall[] {
  // One product can appear on several lines; check the combined demand.
  const byProduct = new Map<string, { productName: string; requested: number; branchQty: number; totalQty: number }>();
  for (const item of items) {
    const entry = byProduct.get(item.productId);
    if (entry) entry.requested += item.quantity;
    else byProduct.set(item.productId, { productName: item.productName, requested: item.quantity, branchQty: item.branchQty, totalQty: item.totalQty });
  }
  const shortfalls: BranchShortfall[] = [];
  for (const [productId, e] of byProduct) {
    if (e.requested > e.branchQty) {
      shortfalls.push({
        productId,
        productName: e.productName,
        requested: e.requested,
        available: e.branchQty,
        elsewhere: Math.max(0, e.totalQty - e.branchQty),
      });
    }
  }
  return shortfalls;
}

/** "Widget (2 at Main branch, 10 more at other branches, 5 requested)" */
export function describeShortfalls(shortfalls: BranchShortfall[], branchName: string): string {
  return shortfalls
    .map((s) => {
      const elsewhere = s.elsewhere > 0 ? `, ${s.elsewhere} more at other branches` : "";
      return `${s.productName} (${s.available} at ${branchName}${elsewhere}, ${s.requested} requested)`;
    })
    .join(", ");
}
