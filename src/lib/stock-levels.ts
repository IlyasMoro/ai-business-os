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

/** Stock a branch can give away and still sit at twice its own reorder level. */
export function spareQuantity(row: Pick<BranchStockRow, "quantity" | "reorderLevel" | "productReorderLevel">): number {
  return Math.max(0, row.quantity - 2 * effectiveReorderLevel(row));
}

export type RestockPlan = {
  /** One draft transfer per route, keyed by "from→to". */
  transfers: { fromBranchId: string; toBranchId: string; lines: { productId: string; quantity: number }[] }[];
  /** What is still missing after transfers, one purchase order per branch. */
  purchases: Map<string, { productId: string; quantity: number }[]>;
};

/**
 * Restocking low branches: cover each shortfall from other branches' spare
 * stock first (biggest spare first, never pushing a donor below twice its
 * reorder level), and buy only what is still missing. `skip` holds
 * "branchId:productId" pairs that already have stock on its way.
 */
export function planRestock(rows: BranchStockRow[], skip: Set<string> = new Set()): RestockPlan {
  const spare = new Map(rows.map((r) => [`${r.branchId}:${r.productId}`, spareQuantity(r)]));
  const routes = new Map<string, RestockPlan["transfers"][number]>();
  const purchases: RestockPlan["purchases"] = new Map();

  for (const low of lowStockRows(rows)) {
    if (skip.has(`${low.branchId}:${low.productId}`)) continue;
    let needed = computeReorderQuantity(low.quantity, effectiveReorderLevel(low));

    const donors = rows
      .filter((r) => r.productId === low.productId && r.branchId !== low.branchId)
      .map((r) => ({ row: r, spare: spare.get(`${r.branchId}:${r.productId}`) ?? 0 }))
      .filter((d) => d.spare > 0)
      .sort((a, b) => b.spare - a.spare);

    for (const donor of donors) {
      if (needed <= 0) break;
      const qty = Math.min(needed, donor.spare);
      spare.set(`${donor.row.branchId}:${donor.row.productId}`, donor.spare - qty);
      needed -= qty;
      const key = `${donor.row.branchId}→${low.branchId}`;
      const route = routes.get(key) ?? { fromBranchId: donor.row.branchId, toBranchId: low.branchId, lines: [] };
      route.lines.push({ productId: low.productId, quantity: qty });
      routes.set(key, route);
    }

    if (needed > 0) {
      const lines = purchases.get(low.branchId) ?? [];
      lines.push({ productId: low.productId, quantity: needed });
      purchases.set(low.branchId, lines);
    }
  }
  return { transfers: [...routes.values()], purchases };
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
