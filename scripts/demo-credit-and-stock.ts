/**
 * Demonstrates the credit limit check and Available to Promise stock check
 * using the actual production functions (src/lib/credit-math.ts and
 * src/lib/stock-math.ts), against realistic scenarios. No database needed,
 * this is the same logic src/lib/actions/sales.ts calls, with the exact
 * message it would show the user.
 *
 * Run with: npx tsx scripts/demo-credit-and-stock.ts
 */
import { evaluateCreditCheck } from "../src/lib/credit-math";
import { findStockShortfalls } from "../src/lib/stock-math";

function heading(text: string) {
  console.log("\n" + "=".repeat(70));
  console.log(text);
  console.log("=".repeat(70));
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

// ---------------------------------------------------------------------
// CREDIT LIMIT CHECK
// ---------------------------------------------------------------------

heading("CREDIT LIMIT CHECK, Meridian Consulting");

const customer = { name: "Meridian Consulting", creditLimit: 15_000 };
const outstandingBalance = 11_200; // two unpaid invoices: SENT + OVERDUE

console.log(`Customer: ${customer.name}`);
console.log(`Credit limit: ${money(customer.creditLimit)}`);
console.log(`Current outstanding balance (unpaid invoices): ${money(outstandingBalance)}`);

console.log("\n--- Order 1: a routine top up order, $2,800 ---");
const order1 = evaluateCreditCheck({
  outstandingBalance,
  creditLimit: customer.creditLimit,
  orderTotal: 2_800,
});
console.log(`Projected balance if approved: ${money(order1.projectedBalance)}`);
console.log(`Within limit: ${order1.withinLimit}`);
console.log(
  order1.withinLimit
    ? `Result: order confirms normally.`
    : `Result: BLOCKED, over by ${money(order1.amountOverLimit)}.`
);

console.log("\n--- Order 2: a larger order placed right after, $4,500 ---");
const order2 = evaluateCreditCheck({
  outstandingBalance,
  creditLimit: customer.creditLimit,
  orderTotal: 4_500,
});
console.log(`Projected balance if approved: ${money(order2.projectedBalance)}`);
console.log(`Within limit: ${order2.withinLimit}`);
if (!order2.withinLimit) {
  const message = `Cannot confirm: ${customer.name}'s balance would be ${money(order2.projectedBalance)}, which is ${money(
    order2.amountOverLimit
  )} over their ${money(customer.creditLimit)} credit limit. Raise the limit, collect payment first, or reduce this order.`;
  console.log(`Result: BLOCKED`);
  console.log(`Message shown in the UI:\n  "${message}"`);
}

// ---------------------------------------------------------------------
// AVAILABLE TO PROMISE, STOCK CHECK
// ---------------------------------------------------------------------

heading("AVAILABLE TO PROMISE CHECK, an order for two products");

const catalogue = [
  { productId: "p_mouse", productName: "Wireless Mouse", stockQty: 42 },
  { productId: "p_keyboard", productName: "Mechanical Keyboard", stockQty: 6 },
];

console.log("Stock on hand:");
for (const p of catalogue) console.log(`  ${p.productName}: ${p.stockQty}`);

console.log("\n--- Order: 10 mice, 15 keyboards ---");
const orderLines = [
  { ...catalogue[0], quantity: 10 },
  { ...catalogue[1], quantity: 15 },
];
const shortfalls = findStockShortfalls(orderLines);

if (shortfalls.length === 0) {
  console.log("Result: every line item is covered, order confirms normally.");
} else {
  const summary = shortfalls
    .map((s) => `${s.productName} (${s.available} in stock, ${s.requested} requested)`)
    .join(", ");
  const message = `Cannot confirm: not enough stock for ${summary}. Receive more stock or reduce the order.`;
  console.log(`Result: BLOCKED`);
  console.log(`Shortfalls: ${JSON.stringify(shortfalls, null, 2)}`);
  console.log(`Message shown in the UI:\n  "${message}"`);
}

console.log("\n--- Same customer reorders within stock, 10 mice, 4 keyboards ---");
const orderLinesOk = [
  { ...catalogue[0], quantity: 10 },
  { ...catalogue[1], quantity: 4 },
];
const shortfallsOk = findStockShortfalls(orderLinesOk);
console.log(
  shortfallsOk.length === 0
    ? "Result: every line item is covered, order confirms normally, and stock will decrement to 32 mice, 2 keyboards on fulfilment."
    : `Result: BLOCKED, ${JSON.stringify(shortfallsOk)}`
);

console.log("\n");
