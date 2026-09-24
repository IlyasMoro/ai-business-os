export type StockShortfall = {
  productId: string;
  productName: string;
  requested: number;
  available: number;
};

/**
 * The ERP course's "Available to Promise" check: before an order is
 * confirmed or fulfilled, confirm every line item's requested quantity is
 * actually covered by stock on hand. Returns one entry per line item that
 * is short, empty when everything can be promised.
 */
export function findStockShortfalls(
  items: { productId: string; productName: string; quantity: number; stockQty: number }[]
): StockShortfall[] {
  return items
    .filter((item) => item.quantity > item.stockQty)
    .map((item) => ({
      productId: item.productId,
      productName: item.productName,
      requested: item.quantity,
      available: item.stockQty,
    }));
}
