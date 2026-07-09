export function computePurchaseOrderTotal(
  items: { quantity: number; unitCost: number }[]
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
}
