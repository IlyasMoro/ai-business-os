export function computeNetPay(grossPay: number, deductions: number): number {
  return grossPay - deductions;
}

export function computePayrollRunTotal(items: { netPay: number }[]): number {
  return items.reduce((sum, item) => sum + item.netPay, 0);
}
