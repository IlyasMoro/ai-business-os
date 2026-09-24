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

/** How close to the limit counts as worth a proactive warning, checked
 * against the current outstanding balance alone, no new order involved.
 * 0.9 means 90% of the limit or higher. */
export const CREDIT_WARNING_THRESHOLD = 0.9;

/**
 * True once a customer's current outstanding balance reaches the warning
 * threshold of their credit limit, so a business can follow up before the
 * next order actually gets blocked. A missing or unset limit never warns.
 */
export function isApproachingCreditLimit(outstandingBalance: number, creditLimit: number | null | undefined): boolean {
  if (creditLimit === null || creditLimit === undefined || creditLimit <= 0) return false;
  return outstandingBalance >= creditLimit * CREDIT_WARNING_THRESHOLD;
}
