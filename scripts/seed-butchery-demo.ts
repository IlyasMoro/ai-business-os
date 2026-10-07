/**
 * Fills the local demo company "Good Hope Demo Butchery" with a realistic
 * halal butchery and grocery: four branches, meat sold by the kilogram,
 * groceries by the piece, stock lots that expire soon, customers, two
 * months of orders and invoices, and six months of till takings and costs.
 * Built for sales demos; every name in it is made up.
 *
 * Local database only: it refuses to run unless DATABASE_URL points at
 * 127.0.0.1, and it only touches the company with the exact demo name.
 * Running it again first clears the demo data it made, then rebuilds it.
 *
 * Run with the local URL from .env.local:
 *   DATABASE_URL=... npx tsx scripts/seed-butchery-demo.ts
 */
import { PrismaClient, type UnitOfMeasure } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { formatOrderNumber } from "../src/lib/order-rules";
import { formatInvoiceNumber } from "../src/lib/invoice-rules";

const COMPANY_NAME = "Good Hope Demo Butchery";
const url = process.env.DATABASE_URL ?? "";
if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
  console.error("Refusing to run: DATABASE_URL is not a local database.");
  process.exit(1);
}
const db = new PrismaClient({ adapter: new PrismaPg(url) });

// Same numbers on every run, so the demo looks the same each time.
let seed = 20261007;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const between = (a: number, b: number) => a + rand() * (b - a);
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const daysAgo = (d: number, hour = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(hour, Math.floor(rand() * 60), 0, 0);
  return t;
};
const daysAhead = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(18, 0, 0, 0);
  return t;
};

type ProductSeed = {
  sku: string;
  name: string;
  unit: UnitOfMeasure;
  cost: number;
  price: number;
  /** Days a fresh delivery lasts; null for dry goods that don't expire. */
  shelfDays: number | null;
  /** Typical stock at the main store. */
  stock: number;
  reorder: number;
  /** Typical quantity on one customer order line. */
  orderQty: [number, number];
};

// Written in rand, the currency the app shows.
const PRODUCTS: ProductSeed[] = [
  { sku: "BEEF-MINCE", name: "Beef mince", unit: "KG", cost: 95, price: 139.99, shelfDays: 4, stock: 42.5, reorder: 15, orderQty: [2, 12] },
  { sku: "BEEF-TBONE", name: "Beef T bone steak", unit: "KG", cost: 140, price: 199.99, shelfDays: 5, stock: 18.4, reorder: 8, orderQty: [1.5, 6] },
  { sku: "BEEF-STEW", name: "Beef stewing pieces", unit: "KG", cost: 88, price: 124.99, shelfDays: 5, stock: 35.2, reorder: 12, orderQty: [2, 10] },
  { sku: "LAMB-CHOPS", name: "Lamb chops", unit: "KG", cost: 165, price: 229.99, shelfDays: 5, stock: 21.75, reorder: 10, orderQty: [1, 6] },
  { sku: "LAMB-MINCE", name: "Lamb mince", unit: "KG", cost: 120, price: 169.99, shelfDays: 4, stock: 14.3, reorder: 8, orderQty: [1, 5] },
  { sku: "CHK-WHOLE", name: "Whole chicken", unit: "KG", cost: 48, price: 69.99, shelfDays: 3, stock: 64.8, reorder: 25, orderQty: [4, 20] },
  { sku: "CHK-BREAST", name: "Chicken breast fillets", unit: "KG", cost: 72, price: 99.99, shelfDays: 3, stock: 38.6, reorder: 15, orderQty: [2, 12] },
  { sku: "BOEREWORS", name: "Beef boerewors", unit: "KG", cost: 85, price: 119.99, shelfDays: 5, stock: 27.9, reorder: 10, orderQty: [2, 8] },
  { sku: "EGGS-30", name: "Eggs, tray of 30", unit: "EACH", cost: 62, price: 89.99, shelfDays: 21, stock: 80, reorder: 30, orderQty: [2, 10] },
  { sku: "BREAD-WHITE", name: "White bread loaf", unit: "EACH", cost: 14, price: 19.99, shelfDays: 4, stock: 120, reorder: 50, orderQty: [5, 30] },
  { sku: "MILK-2L", name: "Fresh milk 2 L", unit: "EACH", cost: 28, price: 36.99, shelfDays: 7, stock: 90, reorder: 40, orderQty: [4, 20] },
  { sku: "OIL-5L", name: "Sunflower oil 5 L", unit: "EACH", cost: 120, price: 159.99, shelfDays: null, stock: 45, reorder: 15, orderQty: [1, 6] },
  { sku: "RICE-10KG", name: "Rice, 10 kg bag", unit: "EACH", cost: 145, price: 189.99, shelfDays: null, stock: 60, reorder: 20, orderQty: [1, 8] },
  { sku: "SPICE-MIX", name: "Braai spice, loose", unit: "KG", cost: 180, price: 259.99, shelfDays: null, stock: 6.25, reorder: 2, orderQty: [0.25, 1.5] },
];

const BRANCHES = [
  { code: "BEL", name: "Bellville", factor: 0.85 },
  { code: "ATH", name: "Athlone", factor: 0.7 },
  { code: "MPL", name: "Mitchells Plain", factor: 0.95 },
];

const CUSTOMERS = [
  { name: "Cape Halaal Grill", company: "Cape Halaal Grill", status: "ACTIVE" as const, credit: 40000 },
  { name: "Bo Kaap Kitchen", company: "Bo Kaap Kitchen", status: "ACTIVE" as const, credit: 25000 },
  { name: "Bellville Lodge", company: "Bellville Lodge", status: "ACTIVE" as const, credit: 30000 },
  { name: "Salt River Catering", company: "Salt River Catering", status: "ACTIVE" as const, credit: 35000 },
  { name: "Athlone Community Hall", company: "Athlone Community Hall", status: "ACTIVE" as const, credit: 15000 },
  { name: "Mitchells Plain Spaza Group", company: "MP Spaza Group", status: "ACTIVE" as const, credit: 20000 },
  { name: "Gatesville Takeaways", company: "Gatesville Takeaways", status: "ACTIVE" as const, credit: 12000 },
  { name: "Wynberg Wedding Venue", company: "Wynberg Wedding Venue", status: "LEAD" as const, credit: null },
  { name: "Claremont School Tuckshop", company: "Claremont School", status: "LEAD" as const, credit: null },
];

const SUPPLIERS = ["Cape Abattoir Supplies", "Western Cape Poultry", "Fresh Bake Bakery", "Valley Dairy", "Peninsula Dry Goods"];

const STAFF = [
  ["Yusuf Adams", "Head butcher", "Butchery"],
  ["Fatima Jacobs", "Branch manager", "Management"],
  ["Riaan Petersen", "Butcher", "Butchery"],
  ["Aisha Davids", "Cashier", "Tills"],
  ["Sipho Ndlovu", "Butcher", "Butchery"],
  ["Nadia Isaacs", "Cashier", "Tills"],
  ["Thabo Mokoena", "Stock controller", "Stores"],
  ["Zainab Hendricks", "Branch manager", "Management"],
  ["Kevin Arendse", "Driver", "Deliveries"],
  ["Ayesha Salie", "Cashier", "Tills"],
  ["Ismail Moosa", "Butcher", "Butchery"],
  ["Lerato Khumalo", "Branch manager", "Management"],
];

async function clearDemo(companyId: string) {
  // Everything the script creates, children first.
  const orders = await db.order.findMany({ where: { companyId }, select: { id: true } });
  await db.transaction.deleteMany({ where: { companyId } });
  await db.invoiceLineItem.deleteMany({ where: { invoice: { companyId } } });
  await db.invoice.deleteMany({ where: { companyId } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
  await db.stockMovement.deleteMany({ where: { companyId } });
  await db.order.deleteMany({ where: { companyId } });
  await db.stockLot.deleteMany({ where: { companyId } });
  await db.branchStock.deleteMany({ where: { companyId } });
  await db.product.deleteMany({ where: { companyId } });
  await db.customer.deleteMany({ where: { companyId } });
  await db.supplier.deleteMany({ where: { companyId } });
  await db.employee.deleteMany({ where: { companyId } });
  await db.branch.deleteMany({ where: { companyId, isMain: false } });
  await db.company.update({ where: { id: companyId }, data: { orderSeq: 0, invoiceSeq: 0 } });
}

async function main() {
  const companies = await db.company.findMany({ where: { name: COMPANY_NAME }, select: { id: true } });
  if (companies.length !== 1) throw new Error(`Expected one company named "${COMPANY_NAME}", found ${companies.length}.`);
  const companyId = companies[0].id;
  await clearDemo(companyId);

  // Branches: the main one from sign up becomes the main store.
  const main = await db.branch.findFirst({ where: { companyId, isMain: true } });
  if (!main) throw new Error("The demo company has no main branch.");
  await db.branch.update({ where: { id: main.id }, data: { name: "Goodwood", address: "Voortrekker Road, Goodwood" } });
  const branches = [{ id: main.id, name: "Main store", factor: 1 }];
  for (const b of BRANCHES) {
    const created = await db.branch.create({ data: { companyId, code: b.code, name: b.name, address: `${b.name}, Cape Town` } });
    branches.push({ id: created.id, name: b.name, factor: b.factor });
  }

  // Products, stock per branch, lots with expiry dates and opening history.
  const products: { id: string; seed: ProductSeed }[] = [];
  for (const p of PRODUCTS) {
    const fresh = p.shelfDays !== null;
    const product = await db.product.create({
      data: {
        companyId,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        cost: round(p.cost),
        unitPrice: round(p.price),
        reorderLevel: p.reorder,
        trackingMode: fresh ? "LOT" : "NONE",
        tracksExpiry: fresh,
        leadTimeDays: fresh ? 1 : 3,
      },
    });
    products.push({ id: product.id, seed: p });

    let total = 0;
    for (const [bi, b] of branches.entries()) {
      let qty = p.stock * b.factor * between(0.8, 1.2);
      // A few shelves run low so the demo has something to reorder.
      if ((p.sku === "LAMB-MINCE" && bi === 2) || (p.sku === "CHK-BREAST" && bi === 1) || (p.sku === "EGGS-30" && bi === 3)) qty = p.reorder * 0.6;
      qty = p.unit === "EACH" ? Math.round(qty) : round(qty, 2);
      total += qty;
      await db.branchStock.create({ data: { companyId, branchId: b.id, productId: product.id, quantity: qty } });
      await db.stockMovement.create({
        data: { companyId, branchId: b.id, productId: product.id, kind: "OPENING", delta: qty, quantityAfter: qty, note: "Opening stock", createdAt: daysAgo(30, 7) },
      });
      if (fresh) {
        // Two deliveries per shelf: an older one close to its date and a newer one.
        const older = p.unit === "EACH" ? Math.round(qty * 0.35) : round(qty * 0.35, 2);
        const newer = p.unit === "EACH" ? qty - older : round(qty - older, 2);
        const soon = bi === 0 || rand() < 0.5 ? 1 + Math.floor(rand() * 2) : 3 + Math.floor(rand() * 2);
        await db.stockLot.create({
          data: { companyId, branchId: b.id, productId: product.id, lotNumber: `${p.sku}-A${bi + 1}`, quantity: older, expiresAt: daysAhead(Math.min(soon, p.shelfDays!)), receivedAt: daysAgo(p.shelfDays! - soon + 1, 6), source: "PO" },
        });
        await db.stockLot.create({
          data: { companyId, branchId: b.id, productId: product.id, lotNumber: `${p.sku}-B${bi + 1}`, quantity: newer, expiresAt: daysAhead(p.shelfDays!), receivedAt: daysAgo(0, 6), source: "PO" },
        });
      }
    }
    await db.product.update({ where: { id: product.id }, data: { stockQty: round(total, 3) } });
  }

  for (const name of SUPPLIERS) {
    await db.supplier.create({ data: { companyId, name, email: `orders@${name.toLowerCase().replace(/[^a-z]+/g, "")}.example`, phone: "021 555 0100" } });
  }

  const customers = [];
  for (const c of CUSTOMERS) {
    customers.push(
      await db.customer.create({
        data: { companyId, name: c.name, company: c.company, status: c.status, creditLimit: c.credit === null ? null : c.credit, email: `buyer@${c.company.toLowerCase().replace(/[^a-z]+/g, "")}.example`, phone: "021 555 0123", createdAt: daysAgo(90) },
      })
    );
  }
  const buyers = customers.filter((c) => c.status === "ACTIVE");

  for (const [i, [name, position, department]] of STAFF.entries()) {
    const branch = branches[i % branches.length];
    const salary = position === "Branch manager" ? 22000 : position === "Head butcher" ? 18500 : position === "Butcher" ? 12500 : 8500;
    await db.employee.create({ data: { companyId, branchId: branch.id, name, position, department, salary: salary, hireDate: daysAgo(200 + i * 30) } });
  }

  // Customer orders over the last 60 days, more around month end (payday).
  let orderSeq = 0;
  let invoiceSeq = 0;
  for (let d = 60; d >= 0; d--) {
    const date = daysAgo(d, 9);
    const payday = date.getDate() >= 24 || date.getDate() <= 2;
    const count = Math.floor(between(0, payday ? 3.5 : 2));
    for (let k = 0; k < count; k++) {
      const customer = pick(buyers);
      const branch = pick(branches);
      const lines = PRODUCTS.map((_, idx) => idx).filter(() => rand() < 0.3).slice(0, 5);
      if (lines.length === 0) lines.push(0);
      const items = lines.map((idx) => {
        const p = products[idx];
        const [lo, hi] = p.seed.orderQty;
        const qty = p.seed.unit === "EACH" ? Math.max(1, Math.round(between(lo, hi))) : round(between(lo, hi), 2);
        return { productId: p.id, quantity: qty, unitPrice: round(p.seed.price) };
      });
      const total = round(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0));
      const status = d > 3 ? (rand() < 0.06 ? "CANCELLED" : "FULFILLED") : d > 1 ? "CONFIRMED" : "PENDING";
      orderSeq++;
      const order = await db.order.create({
        data: {
          companyId,
          branchId: branch.id,
          customerId: customer.id,
          orderNumber: formatOrderNumber(orderSeq),
          status,
          totalAmount: total,
          createdAt: date,
          fulfilledAt: status === "FULFILLED" ? daysAgo(Math.max(0, d - 1), 14) : null,
          items: { create: items },
        },
      });

      if (status === "FULFILLED") {
        invoiceSeq++;
        const age = d - 1;
        // Older invoices are paid; a few recent ones are waiting, two are late.
        const invStatus = age > 20 ? (rand() < 0.08 ? "OVERDUE" : "PAID") : age > 7 ? (rand() < 0.5 ? "PAID" : "SENT") : "SENT";
        const issue = daysAgo(age, 15);
        const due = new Date(issue);
        due.setDate(due.getDate() + 14);
        const invoice = await db.invoice.create({
          data: {
            companyId,
            branchId: branch.id,
            customerId: customer.id,
            orderId: order.id,
            invoiceNumber: formatInvoiceNumber(invoiceSeq),
            status: invStatus,
            issueDate: issue,
            sentAt: issue,
            dueDate: due,
            totalAmount: total,
            amountPaid: invStatus === "PAID" ? total : 0,
            createdAt: issue,
            lineItems: {
              create: items.map((it) => ({
                description: products.find((p) => p.id === it.productId)!.seed.name,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                productId: it.productId,
              })),
            },
          },
        });
        if (invStatus === "PAID") {
          const paidOn = daysAgo(Math.max(0, age - 10), 11);
          await db.transaction.create({
            data: { companyId, branchId: branch.id, invoiceId: invoice.id, type: "INCOME", category: "Account sales", amount: total, description: `Payment for ${invoice.invoiceNumber}`, date: paidOn },
          });
        }
      }
    }
  }
  await db.company.update({ where: { id: companyId }, data: { orderSeq, invoiceSeq } });

  // Six months of walk in till takings and running costs per branch.
  // Month end and the Eid month are busier, as they are for a halal butchery.
  for (let m = 5; m >= 0; m--) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setMonth(monthStart.getMonth() - m);
    const eidBoost = m === 4 ? 1.35 : 1;
    const growth = 1 + (5 - m) * 0.03;
    for (const b of branches) {
      for (let week = 0; week < 4; week++) {
        const day = new Date(monthStart);
        day.setDate(1 + week * 7 + 5);
        if (day > new Date()) continue;
        const payday = week === 3 ? 1.25 : 1;
        await db.transaction.create({
          data: { companyId, branchId: b.id, type: "INCOME", category: "Till sales", amount: round(between(68000, 82000) * b.factor * eidBoost * growth * payday), description: `Week ${week + 1} till takings`, date: day },
        });
      }
      const costs: [string, number][] = [
        ["Meat and poultry purchases", 150000],
        ["Groceries purchases", 36000],
        ["Wages", 70000],
        ["Rent", 28000],
        ["Electricity and refrigeration", 14500],
      ];
      for (const [category, base] of costs) {
        const day = new Date(monthStart);
        day.setDate(category === "Rent" ? 1 : category === "Wages" ? 25 : 15);
        if (day > new Date()) continue;
        const swing = category.includes("purchases") ? eidBoost * growth * between(0.95, 1.05) : between(0.98, 1.02);
        await db.transaction.create({
          data: { companyId, branchId: b.id, type: "EXPENSE", category, amount: round(base * b.factor * swing), date: day },
        });
      }
    }
  }

  console.log(`Done: ${branches.length} branches, ${products.length} products, ${customers.length} customers, ${orderSeq} orders, ${invoiceSeq} invoices.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
