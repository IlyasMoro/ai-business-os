export const WorkOrderStatusValues = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type WorkOrderStatus = (typeof WorkOrderStatusValues)[number];

const workOrderTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextWorkOrderStatuses(status: WorkOrderStatus): WorkOrderStatus[] {
  return workOrderTransitions[status];
}

export function canTransitionWorkOrder(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return workOrderTransitions[from].includes(to);
}

export function formatWorkOrderNumber(sequence: number): string {
  return `WO${String(sequence).padStart(4, "0")}`;
}

export type BomEdge = { parentId: string; componentId: string; quantity: number };

/**
 * Adding `componentId` under `parentId` creates a loop if the parent is
 * the component itself, or is already somewhere inside the component's
 * own bill of materials.
 */
export function wouldCreateBomCycle(bom: BomEdge[], parentId: string, componentId: string): boolean {
  if (parentId === componentId) return true;
  const children = new Map<string, string[]>();
  for (const edge of bom) {
    children.set(edge.parentId, [...(children.get(edge.parentId) ?? []), edge.componentId]);
  }
  const seen = new Set<string>();
  const stack = [componentId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === parentId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return false;
}

/**
 * Component units needed to build `quantity` of a product, rounded up to
 * whole units per component.
 */
export function explodeBom(lines: { componentId: string; quantity: number }[], quantity: number) {
  return lines.map((line) => ({ componentId: line.componentId, required: Math.ceil(line.quantity * quantity) }));
}

/**
 * Low level code: how deep a product sits in any bill of materials
 * (finished goods are 0, their components 1, and so on). Planning runs
 * level by level so a component's demand is complete before it's netted.
 */
export function lowLevelCodes(productIds: string[], bom: BomEdge[]): Map<string, number> {
  const level = new Map(productIds.map((id) => [id, 0]));
  // Longest path relaxation; bounded by the product count so a bad cycle
  // in the data can never loop forever.
  for (let pass = 0; pass < productIds.length; pass++) {
    let changed = false;
    for (const edge of bom) {
      const next = (level.get(edge.parentId) ?? 0) + 1;
      if (next > (level.get(edge.componentId) ?? 0)) {
        level.set(edge.componentId, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return level;
}

export type PlanProduct = {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  safetyStock: number;
  leadTimeDays: number;
  lotSize: number;
  preferredSupplierId: string | null;
};

export type PlanInput = {
  products: PlanProduct[];
  bom: BomEdge[];
  /** Units customers are waiting for, from open sales orders. */
  salesDemand: Map<string, number>;
  /** Units already on the way: open purchase orders and work order output. */
  scheduledReceipts: Map<string, number>;
  /** Components still to be used by work orders that are already open. */
  openWorkOrderDemand: Map<string, number>;
  today?: Date;
};

export type PlanRow = {
  productId: string;
  name: string;
  sku: string;
  action: "MAKE" | "BUY";
  level: number;
  salesDemand: number;
  componentDemand: number;
  onHand: number;
  onOrder: number;
  safetyStock: number;
  shortfall: number;
  plannedQty: number;
  leadTimeDays: number;
  availableBy: Date;
  preferredSupplierId: string | null;
};

/** Rounds a shortfall up to whole lots; a lot size below 1 counts as 1. */
export function roundToLot(shortfall: number, lotSize: number): number {
  if (shortfall <= 0) return 0;
  const lot = Math.max(1, Math.floor(lotSize));
  return Math.ceil(shortfall / lot) * lot;
}

/**
 * The MRP run. For each product, top level first:
 *   shortfall = sales demand + component demand + safety stock
 *             minus (on hand + on order)
 * A shortfall becomes a planned order rounded up to the lot size. Planned
 * orders for made products push demand down onto their components.
 */
export function runMrp(input: PlanInput): PlanRow[] {
  const today = input.today ?? new Date();
  const levels = lowLevelCodes(
    input.products.map((p) => p.id),
    input.bom
  );
  const bomByParent = new Map<string, BomEdge[]>();
  for (const edge of input.bom) {
    bomByParent.set(edge.parentId, [...(bomByParent.get(edge.parentId) ?? []), edge]);
  }

  const componentDemand = new Map(input.openWorkOrderDemand);
  const ordered = [...input.products].sort(
    (a, b) => (levels.get(a.id) ?? 0) - (levels.get(b.id) ?? 0) || a.name.localeCompare(b.name)
  );

  const rows: PlanRow[] = [];
  for (const product of ordered) {
    const sales = input.salesDemand.get(product.id) ?? 0;
    const dependent = componentDemand.get(product.id) ?? 0;
    const onOrder = input.scheduledReceipts.get(product.id) ?? 0;
    const safety = Math.max(0, product.safetyStock);
    const shortfall = Math.max(0, sales + dependent + safety - (product.stockQty + onOrder));
    const plannedQty = roundToLot(shortfall, product.lotSize);
    const lines = bomByParent.get(product.id) ?? [];

    if (plannedQty > 0) {
      for (const { componentId, required } of explodeBom(lines, plannedQty)) {
        componentDemand.set(componentId, (componentDemand.get(componentId) ?? 0) + required);
      }
    }

    rows.push({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      action: lines.length > 0 ? "MAKE" : "BUY",
      level: levels.get(product.id) ?? 0,
      salesDemand: sales,
      componentDemand: dependent,
      onHand: product.stockQty,
      onOrder,
      safetyStock: safety,
      shortfall,
      plannedQty,
      leadTimeDays: product.leadTimeDays,
      availableBy: new Date(today.getTime() + Math.max(0, product.leadTimeDays) * 24 * 60 * 60 * 1000),
      preferredSupplierId: product.preferredSupplierId,
    });
  }
  return rows;
}
