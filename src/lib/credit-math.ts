export type CreditCheckResult = {
  projectedBalance: number;
  withinLimit: boolean;
  amountOverLimit: number;
};

/**
 * Checks a new order against a customer's credit limit, the same way the
 * ERP course's "credit management" scenario does: current outstanding
 * balance (unpaid invoices) plus the new order, compared to the limit.
 *
 * A missing or unset credit limit means no limit is enforced.
 */
export function evaluateCreditCheck({
  outstandingBalance,
  creditLimit,
  orderTotal,
}: {
  outstandingBalance: number;
  creditLimit: number | null | undefined;
  orderTotal: number;
}): CreditCheckResult {
  const projectedBalance = outstandingBalance + orderTotal;

  if (creditLimit === null || creditLimit === undefined) {
    return { projectedBalance, withinLimit: true, amountOverLimit: 0 };
  }

  const amountOverLimit = Math.max(0, projectedBalance - creditLimit);

  return {
    projectedBalance,
    withinLimit: amountOverLimit === 0,
    amountOverLimit,
  };
}
