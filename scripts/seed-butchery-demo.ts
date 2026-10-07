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
import bcrypt from "bcryptjs";
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
  { sku: "BEEFMINCE", name: "Beef mince", unit: "KG", cost: 95, price: 139.99, shelfDays: 4, stock: 42.5, reorder: 15, orderQty: [2, 12] },
  { sku: "BEEFTBONE", name: "Beef T bone steak", unit: "KG", cost: 140, price: 199.99, shelfDays: 5, stock: 18.4, reorder: 8, orderQty: [1.5, 6] },
  { sku: "BEEFSTEW", name: "Beef stewing pieces", unit: "KG", cost: 88, price: 124.99, shelfDays: 5, stock: 35.2, reorder: 12, orderQty: [2, 10] },
  { sku: "LAMBCHOPS", name: "Lamb chops", unit: "KG", cost: 165, price: 229.99, shelfDays: 5, stock: 21.75, reorder: 10, orderQty: [1, 6] },
  { sku: "LAMBMINCE", name: "Lamb mince", unit: "KG", cost: 120, price: 169.99, shelfDays: 4, stock: 14.3, reorder: 8, orderQty: [1, 5] },
  { sku: "CHKWHOLE", name: "Whole chicken", unit: "KG", cost: 48, price: 69.99, shelfDays: 3, stock: 64.8, reorder: 25, orderQty: [4, 20] },
  { sku: "CHKBREAST", name: "Chicken breast fillets", unit: "KG", cost: 72, price: 99.99, shelfDays: 3, stock: 38.6, reorder: 15, orderQty: [2, 12] },
  { sku: "BOEREWORS", name: "Beef boerewors", unit: "KG", cost: 85, price: 119.99, shelfDays: 5, stock: 27.9, reorder: 10, orderQty: [2, 8] },
  { sku: "EGGS30", name: "Eggs, tray of 30", unit: "EACH", cost: 62, price: 89.99, shelfDays: 21, stock: 80, reorder: 30, orderQty: [2, 10] },
  { sku: "BREADWHITE", name: "White bread loaf", unit: "EACH", cost: 14, price: 19.99, shelfDays: 4, stock: 120, reorder: 50, orderQty: [5, 30] },
  { sku: "MILK2L", name: "Fresh milk 2 L", unit: "EACH", cost: 28, price: 36.99, shelfDays: 7, stock: 90, reorder: 40, orderQty: [4, 20] },
  { sku: "OIL5L", name: "Sunflower oil 5 L", unit: "EACH", cost: 120, price: 159.99, shelfDays: null, stock: 45, reorder: 15, orderQty: [1, 6] },
  { sku: "RICE10KG", name: "Rice, 10 kg bag", unit: "EACH", cost: 145, price: 189.99, shelfDays: null, stock: 60, reorder: 20, orderQty: [1, 8] },
  { sku: "SPICEMIX", name: "Braai spice, loose", unit: "KG", cost: 180, price: 259.99, shelfDays: null, stock: 6.25, reorder: 2, orderQty: [0.25, 1.5] },
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
  await db.returnAuthorization.deleteMany({ where: { companyId } });
  await db.quote.deleteMany({ where: { companyId } });
  await db.deal.deleteMany({ where: { companyId } });
  await db.ticket.deleteMany({ where: { companyId } });
  await db.project.deleteMany({ where: { companyId } });
  await db.stockTransfer.deleteMany({ where: { companyId } });
  await db.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId } } });
  await db.purchaseOrder.deleteMany({ where: { companyId } });
  await db.payrollItem.deleteMany({ where: { payrollRun: { companyId } } });
  await db.payrollRun.deleteMany({ where: { companyId } });
  await db.customer.updateMany({ where: { companyId }, data: { campaignId: null } });
  await db.campaign.deleteMany({ where: { companyId } });
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
  await db.company.update({ where: { id: companyId }, data: { orderSeq: 0, invoiceSeq: 0, purchaseOrderSeq: 0 } });
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
      if ((p.sku === "LAMBMINCE" && bi === 2) || (p.sku === "CHKBREAST" && bi === 1) || (p.sku === "EGGS30" && bi === 3)) qty = p.reorder * 0.6;
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
          data: { companyId, branchId: b.id, productId: product.id, lotNumber: `${p.sku}A${bi + 1}`, quantity: older, expiresAt: daysAhead(Math.min(soon, p.shelfDays!)), receivedAt: daysAgo(p.shelfDays! - soon + 1, 6), source: "PO" },
        });
        await db.stockLot.create({
          data: { companyId, branchId: b.id, productId: product.id, lotNumber: `${p.sku}B${bi + 1}`, quantity: newer, expiresAt: daysAhead(p.shelfDays!), receivedAt: daysAgo(0, 6), source: "PO" },
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

  const employees = [];
  for (const [i, [name, position, department]] of STAFF.entries()) {
    const branch = branches[i % branches.length];
    const salary = position === "Branch manager" ? 22000 : position === "Head butcher" ? 18500 : position === "Butcher" ? 12500 : 8500;
    employees.push(await db.employee.create({ data: { companyId, branchId: branch.id, name, position, department, salary, hireDate: daysAgo(200 + i * 30) } }));
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

  const extras = await seedWorkModules({ companyId, branches, products, customers, employees });

  console.log(`Done: ${branches.length} branches, ${products.length} products, ${customers.length} customers, ${orderSeq} orders, ${invoiceSeq} invoices, ${extras}.`);
}

/** Quotes, deals, projects, support tickets, returns and transfers, so no
 * module looks empty in a demo. */
async function seedWorkModules({
  companyId,
  branches,
  products,
  customers,
  employees,
}: {
  companyId: string;
  branches: { id: string; name: string }[];
  products: { id: string; seed: ProductSeed }[];
  customers: { id: string; name: string; status: string }[];
  employees: { id: string; name: string }[];
}) {
  const owner = await db.user.findFirst({ where: { companyId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const ownerId = owner?.id ?? null;
  const bySku = (sku: string) => products.find((p) => p.seed.sku === sku)!;
  const cust = (name: string) => customers.find((c) => c.name === name)!;
  const staff = (name: string) => employees.find((e) => e.name === name)!.id;

  // Deals across the pipeline, worth what a catering or venue account is.
  const deals = [
    { title: "Wedding season meat supply", customer: "Wynberg Wedding Venue", value: 85000, stage: "PROPOSAL" as const, probability: 50, close: 12 },
    { title: "School tuckshop weekly order", customer: "Claremont School Tuckshop", value: 24000, stage: "QUALIFIED" as const, probability: 30, close: 25 },
    { title: "Eid catering contract", customer: "Salt River Catering", value: 120000, stage: "NEGOTIATION" as const, probability: 70, close: 6 },
    { title: "Grill restaurant boerewors account", customer: "Cape Halaal Grill", value: 46000, stage: "WON" as const, probability: 100, close: -8 },
    { title: "Lodge breakfast supply", customer: "Bellville Lodge", value: 18000, stage: "NEW" as const, probability: 10, close: 40 },
    { title: "Takeaway chicken supply", customer: "Gatesville Takeaways", value: 31000, stage: "LOST" as const, probability: 0, close: -15 },
  ];
  const dealIds: Record<string, string> = {};
  for (const [i, d] of deals.entries()) {
    const closed = d.stage === "WON" || d.stage === "LOST";
    const deal = await db.deal.create({
      data: {
        companyId,
        customerId: cust(d.customer).id,
        ownerId,
        title: d.title,
        value: d.value,
        stage: d.stage,
        probability: d.probability,
        position: i,
        expectedClose: daysAhead(d.close),
        closedAt: closed ? daysAgo(-d.close) : null,
        lostReason: d.stage === "LOST" ? "Went with a cheaper supplier" : null,
        createdAt: daysAgo(30 + i * 4),
      },
    });
    dealIds[d.customer] = deal.id;
  }

  // Quotes in every state, priced from the product list.
  const quotes = [
    { customer: "Wynberg Wedding Venue", status: "SENT" as const, age: 4, valid: 10, lines: [["LAMBCHOPS", 40], ["BEEFTBONE", 25], ["BOEREWORS", 30]] },
    { customer: "Salt River Catering", status: "SENT" as const, age: 2, valid: 12, lines: [["BEEFMINCE", 60], ["CHKWHOLE", 80], ["RICE10KG", 20]] },
    { customer: "Claremont School Tuckshop", status: "DRAFT" as const, age: 1, valid: 14, lines: [["BREADWHITE", 120], ["MILK2L", 60], ["EGGS30", 10]] },
    { customer: "Cape Halaal Grill", status: "ACCEPTED" as const, age: 12, valid: 2, lines: [["BOEREWORS", 50], ["SPICEMIX", 5]] },
    { customer: "Gatesville Takeaways", status: "DECLINED" as const, age: 18, valid: -4, lines: [["CHKBREAST", 45], ["OIL5L", 12]] },
  ];
  for (const [i, q] of quotes.entries()) {
    const items = q.lines.map(([sku, qty]) => {
      const p = bySku(sku as string);
      return { productId: p.id, quantity: qty as number, unitPrice: round(p.seed.price) };
    });
    const created = daysAgo(q.age, 10);
    await db.quote.create({
      data: {
        companyId,
        customerId: cust(q.customer).id,
        dealId: dealIds[q.customer] ?? null,
        ownerId,
        branchId: branches[0].id,
        quoteNumber: `Q${String(i + 1).padStart(4, "0")}`,
        status: q.status,
        validUntil: daysAhead(q.valid),
        totalAmount: round(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)),
        sentAt: q.status === "DRAFT" ? null : created,
        decidedAt: q.status === "ACCEPTED" || q.status === "DECLINED" ? daysAgo(q.age - 3, 14) : null,
        declineReason: q.status === "DECLINED" ? "Price too high for this month" : null,
        createdAt: created,
        items: { create: items },
      },
    });
  }

  // Projects with tasks spread over the team.
  const projects = [
    {
      name: "Eid stock up plan",
      description: "Order, store and price extra lamb and beef for the Eid rush across all branches.",
      due: 21,
      status: "ACTIVE" as const,
      tasks: [
        ["Confirm lamb volumes with Cape Abattoir Supplies", "DONE", "HIGH", "Yusuf Adams", -3],
        ["Book extra cold room space at Bellville", "IN_PROGRESS", "HIGH", "Zainab Hendricks", 4],
        ["Print Eid price boards for every branch", "TODO", "MEDIUM", "Fatima Jacobs", 10],
        ["Roster extra butchers for the week before Eid", "TODO", "MEDIUM", "Lerato Khumalo", 12],
      ],
    },
    {
      name: "Mitchells Plain shop refit",
      description: "New display fridges and a second till point at the Mitchells Plain branch.",
      due: 45,
      status: "ACTIVE" as const,
      tasks: [
        ["Get three quotes for display fridges", "DONE", "MEDIUM", "Lerato Khumalo", -10],
        ["Choose the fridge supplier", "IN_PROGRESS", "MEDIUM", "Lerato Khumalo", 5],
        ["Train cashiers on the second till", "TODO", "LOW", "Ayesha Salie", 30],
      ],
    },
    {
      name: "Monthly stock count",
      description: "Full count of every shelf and cold room at month end.",
      due: -2,
      status: "COMPLETED" as const,
      tasks: [
        ["Count Goodwood cold room", "DONE", "MEDIUM", "Thabo Mokoena", -3],
        ["Count Athlone shelves", "DONE", "MEDIUM", "Riaan Petersen", -3],
      ],
    },
  ];
  let taskCount = 0;
  for (const [i, p] of projects.entries()) {
    await db.project.create({
      data: {
        companyId,
        name: p.name,
        description: p.description,
        status: p.status,
        dueDate: daysAhead(p.due),
        createdAt: daysAgo(40 - i * 10),
        tasks: {
          create: p.tasks.map(([title, status, priority, who, due]) => ({
            title: title as string,
            status: status as "TODO" | "IN_PROGRESS" | "DONE",
            priority: priority as "LOW" | "MEDIUM" | "HIGH",
            assigneeId: staff(who as string),
            dueDate: daysAhead(due as number),
          })),
        },
      },
    });
    taskCount += p.tasks.length;
  }

  // Support tickets from account customers, each with a short thread.
  const tickets = [
    { customer: "Bo Kaap Kitchen", subject: "Short delivery on boerewors", status: "OPEN" as const, priority: "HIGH" as const, who: "Kevin Arendse", age: 1, ask: "We ordered 20 kg of boerewors yesterday but only 15 kg arrived.", reply: null },
    { customer: "Bellville Lodge", subject: "Invoice sent to the wrong email", status: "IN_PROGRESS" as const, priority: "MEDIUM" as const, who: "Fatima Jacobs", age: 3, ask: "Please send our invoices to accounts@bellvillelodge.example from now on.", reply: "Thanks, we have updated the address and will resend the last invoice today." },
    { customer: "Cape Halaal Grill", subject: "Halaal certificate copy", status: "RESOLVED" as const, priority: "LOW" as const, who: "Zainab Hendricks", age: 9, ask: "Can you email a copy of your current halaal certificate?", reply: "Attached, valid until the end of next year." },
    { customer: "Athlone Community Hall", subject: "Change Saturday delivery time", status: "OPEN" as const, priority: "MEDIUM" as const, who: null, age: 0, ask: "Could Saturday deliveries come before 08:00 instead of 10:00?", reply: null },
    { customer: "Salt River Catering", subject: "Lamb chops cut too thick", status: "CLOSED" as const, priority: "LOW" as const, who: "Yusuf Adams", age: 20, ask: "The last lamb chops were cut thicker than usual.", reply: "Sorry about that, the butchers now cut your order at 2 cm as agreed." },
  ];
  for (const t of tickets) {
    const opened = daysAgo(t.age, 9);
    await db.ticket.create({
      data: {
        companyId,
        customerId: cust(t.customer).id,
        subject: t.subject,
        description: t.ask,
        status: t.status,
        priority: t.priority,
        assigneeId: t.who ? staff(t.who) : null,
        createdAt: opened,
        messages: {
          create: [
            { content: t.ask, authorType: "CUSTOMER" as const, createdAt: opened },
            ...(t.reply ? [{ content: t.reply, authorType: "STAFF" as const, authorId: ownerId, createdAt: daysAgo(Math.max(0, t.age - 1), 11) }] : []),
          ],
        },
      },
    });
  }

  // Returns against recent fulfilled orders, in three states.
  const recent = await db.order.findMany({
    where: { companyId, status: "FULFILLED" },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { items: true },
  });
  const returnStates = [
    { status: "REQUESTED" as const, reason: "Chicken arrived above 4°C", condition: "DAMAGED" as const },
    { status: "RECEIVED" as const, reason: "Wrong product delivered", condition: "RESELLABLE" as const },
    { status: "REFUNDED" as const, reason: "Customer over ordered for an event", condition: "RESELLABLE" as const },
  ];
  for (const [i, order] of recent.entries()) {
    const state = returnStates[i];
    const item = order.items[0];
    const qty = Math.max(1, Math.round((item.quantity / 2) * 100) / 100);
    await db.returnAuthorization.create({
      data: {
        companyId,
        orderId: order.id,
        rmaNumber: `RMA${String(i + 1).padStart(4, "0")}`,
        status: state.status,
        reason: state.reason,
        refundAmount: state.status === "REFUNDED" ? round(qty * item.unitPrice) : 0,
        createdAt: daysAgo(2, 12),
        receivedAt: state.status === "REQUESTED" ? null : daysAgo(1, 10),
        refundedAt: state.status === "REFUNDED" ? daysAgo(0, 9) : null,
        items: { create: [{ orderItemId: item.id, productId: item.productId, quantity: qty, unitPrice: item.unitPrice, condition: state.condition }] },
      },
    });
  }

  // Transfers: one delivered last month and two drafts waiting, one
  // suggested by the low stock automation and so needing approval.
  const transfers = [
    { from: 0, to: 2, status: "RECEIVED" as const, age: 40, auto: false, note: "Lamb for the Athlone weekend special", lines: [["LAMBCHOPS", 12.5], ["LAMBMINCE", 8]] },
    { from: 0, to: 1, status: "DRAFT" as const, age: 0, auto: true, note: "Suggested by the low stock automation", lines: [["CHKBREAST", 10]] },
    { from: 1, to: 3, status: "DRAFT" as const, age: 1, auto: false, note: "Eggs for Mitchells Plain", lines: [["EGGS30", 12]] },
  ];
  for (const [i, t] of transfers.entries()) {
    const created = daysAgo(t.age, 8);
    await db.stockTransfer.create({
      data: {
        companyId,
        transferNumber: `TR${String(i + 1).padStart(4, "0")}`,
        fromBranchId: branches[t.from].id,
        toBranchId: branches[t.to].id,
        status: t.status,
        autoCreated: t.auto,
        note: t.note,
        createdAt: created,
        sentAt: t.status === "RECEIVED" ? created : null,
        receivedAt: t.status === "RECEIVED" ? daysAgo(t.age - 1, 9) : null,
        items: { create: t.lines.map(([sku, qty]) => ({ productId: bySku(sku as string).id, quantity: qty as number })) },
      },
    });
  }

  // Marketing: two campaigns that brought the two open leads.
  const campaigns = [
    { name: "Eid specials on WhatsApp", channel: "SOCIAL" as const, status: "ACTIVE" as const, budget: 6000, spent: 3800, start: -20, end: 10, lead: "Wynberg Wedding Venue" },
    { name: "School tuckshop flyers", channel: "EVENT" as const, status: "ACTIVE" as const, budget: 2500, spent: 1900, start: -35, end: 5, lead: "Claremont School Tuckshop" },
    { name: "Payday braai packs", channel: "ADS" as const, status: "COMPLETED" as const, budget: 4000, spent: 4000, start: -70, end: -40, lead: null },
  ];
  for (const c of campaigns) {
    const campaign = await db.campaign.create({
      data: { companyId, name: c.name, channel: c.channel, status: c.status, budget: c.budget, spent: c.spent, startDate: daysAhead(c.start), endDate: daysAhead(c.end), createdAt: daysAhead(c.start - 3) },
    });
    if (c.lead) await db.customer.update({ where: { id: cust(c.lead).id }, data: { campaignId: campaign.id } });
  }

  // Purchase orders to suppliers: one received, one ordered, one draft
  // suggested by the low stock automation.
  const suppliers = await db.supplier.findMany({ where: { companyId }, select: { id: true, name: true } });
  const supplier = (name: string) => suppliers.find((s) => s.name === name)!.id;
  const pos = [
    { supplier: "Cape Abattoir Supplies", status: "RECEIVED" as const, age: 9, branch: 0, auto: false, lines: [["BEEFMINCE", 80], ["LAMBCHOPS", 40]] },
    { supplier: "Western Cape Poultry", status: "ORDERED" as const, age: 2, branch: 1, auto: false, lines: [["CHKBREAST", 60], ["CHKWHOLE", 50]] },
    { supplier: "Peninsula Dry Goods", status: "DRAFT" as const, age: 0, branch: 3, auto: true, lines: [["EGGS30", 40], ["OIL5L", 24]] },
  ];
  for (const [i, po] of pos.entries()) {
    const items = po.lines.map(([sku, qty]) => {
      const p = bySku(sku as string);
      return { productId: p.id, quantity: qty as number, unitCost: round(p.seed.cost) };
    });
    const created = daysAgo(po.age, 8);
    await db.purchaseOrder.create({
      data: {
        companyId,
        supplierId: supplier(po.supplier),
        branchId: branches[po.branch].id,
        poNumber: `PO${String(i + 1).padStart(4, "0")}`,
        status: po.status,
        autoCreated: po.auto,
        totalAmount: round(items.reduce((s, it) => s + it.quantity * it.unitCost, 0)),
        createdAt: created,
        sentAt: po.status === "DRAFT" ? null : created,
        expectedDate: daysAhead(po.status === "RECEIVED" ? -7 : 2),
        receivedAt: po.status === "RECEIVED" ? daysAgo(po.age - 2, 7) : null,
        items: { create: items },
      },
    });
  }
  await db.company.update({ where: { id: companyId }, data: { purchaseOrderSeq: pos.length } });

  // Last month's payroll, paid, for every employee.
  const lastMonthStart = new Date();
  lastMonthStart.setDate(1);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  lastMonthStart.setHours(0, 0, 0, 0);
  const lastMonthEnd = new Date(lastMonthStart.getFullYear(), lastMonthStart.getMonth() + 1, 0, 12);
  const staffPay = await db.employee.findMany({ where: { companyId }, select: { id: true, salary: true } });
  const payItems = staffPay.map((e) => {
    // Roughly PAYE and UIF together.
    const deductions = round(e.salary * (e.salary > 15000 ? 0.18 : 0.08));
    return { employeeId: e.id, grossPay: e.salary, deductions, netPay: round(e.salary - deductions) };
  });
  await db.payrollRun.create({
    data: {
      companyId,
      periodStart: lastMonthStart,
      periodEnd: lastMonthEnd,
      status: "PAID",
      processedAt: new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 25, 10),
      totalAmount: round(payItems.reduce((s, it) => s + it.netPay, 0)),
      items: { create: payItems },
    },
  });

  const cashier = await seedCashierLogin(companyId, staff("Ayesha Salie"), cust("Bellville Lodge").id);

  return `${campaigns.length} campaigns, ${pos.length} purchase orders, 1 payroll run, ${deals.length} deals, ${quotes.length} quotes, ${projects.length} projects with ${taskCount} tasks, ${tickets.length} tickets, ${recent.length} returns, ${transfers.length} transfers${cashier}`;
}

/** A second sign in with the ready made Cashier role, to show the limited
 * dashboard. Only made when DEMO_CASHIER_PASSWORD is set, so no password
 * ever lives in this file. */
async function seedCashierLogin(companyId: string, employeeId: string, customerId: string) {
  const password = process.env.DEMO_CASHIER_PASSWORD;
  if (!password) return "";
  const role = await db.companyRole.findFirst({ where: { companyId, preset: "CASHIER" }, select: { id: true } });
  if (!role) return ", no Cashier role yet (open Team and roles once, then run again)";
  const email = "cashier@aibos.test";
  const employee = await db.employee.update({ where: { id: employeeId }, data: { email }, select: { branchId: true } });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: "Ayesha Salie", passwordHash, role: "EMPLOYEE", companyId, companyRoleId: role.id, branchId: employee.branchId },
    update: { name: "Ayesha Salie", passwordHash, role: "EMPLOYEE", companyId, companyRoleId: role.id, branchId: employee.branchId },
  });
  await db.followUp.deleteMany({ where: { companyId, assigneeId: user.id } });
  await db.followUp.create({ data: { companyId, customerId, assigneeId: user.id, title: "Call about the Friday braai order", dueAt: daysAhead(1) } });
  return `, cashier login ${email}`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
