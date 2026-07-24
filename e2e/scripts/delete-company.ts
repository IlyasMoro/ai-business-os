import "dotenv/config";
import { db } from "../../src/lib/db";

const name = process.argv[2];

(async () => {
  if (!name) return;

  const companies = await db.company.findMany({ where: { name }, select: { id: true } });
  const companyIds = companies.map((c) => c.id);
  if (companyIds.length === 0) return;

  // Product has RESTRICT (not CASCADE) foreign keys from OrderItem,
  // InvoiceLineItem, and PurchaseOrderItem, to protect transactional
  // history from accidental deletion. A plain `company.delete()` fails
  // once any test data has created that kind of link, so those dependents
  // must be cleared explicitly, in order, before the company itself goes.
  const where = { companyId: { in: companyIds } };

  await db.taskComment.deleteMany({ where: { task: { project: { companyId: { in: companyIds } } } } });
  await db.ticketMessage.deleteMany({ where: { ticket: { companyId: { in: companyIds } } } });
  await db.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { companyId: { in: companyIds } } } });
  await db.orderItem.deleteMany({ where: { order: { companyId: { in: companyIds } } } });
  await db.invoiceLineItem.deleteMany({ where: { invoice: { companyId: { in: companyIds } } } });
  await db.payrollItem.deleteMany({ where: { payrollRun: { companyId: { in: companyIds } } } });

  await db.purchaseOrder.deleteMany({ where });
  await db.order.deleteMany({ where });
  await db.transaction.deleteMany({ where });
  await db.invoice.deleteMany({ where });
  await db.payrollRun.deleteMany({ where });

  await db.company.deleteMany({ where: { id: { in: companyIds } } });
})().finally(() => db.$disconnect());
