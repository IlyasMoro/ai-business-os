export function computeInvoiceSubtotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function computeInvoiceTax(subtotal: number, taxRate: number): number {
  return subtotal * (taxRate / 100);
}

export function computeInvoiceTotal(
  items: { quantity: number; unitPrice: number }[],
  taxRate = 0
): number {
  const subtotal = computeInvoiceSubtotal(items);
  return subtotal + computeInvoiceTax(subtotal, taxRate);
}
