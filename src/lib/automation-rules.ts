export function needsReorder(stockQty: number, reorderLevel: number): boolean {
  return stockQty <= reorderLevel;
}

export function computeReorderQuantity(stockQty: number, reorderLevel: number): number {
  return Math.max(1, reorderLevel * 2 - stockQty);
}
