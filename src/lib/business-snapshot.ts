import { formatCurrency } from "@/lib/utils";
import "server-only";
import type { ModuleKey } from "@/lib/role-access";
import { db } from "@/lib/db";
import { lowStockAt } from "@/lib/stock";

/** Company wide, or one branch's orders, invoices and stock when branchId is set. */
export async function getBusinessSnapshot(companyId: string, branchId: string | null = null) {
  const inBranch = branchId ? { branchId } : {};
  const [customerCount, openOrderCount, lowStock, outstandingInvoiceCount, openTicketCount, activeProjectCount, openDeals] =
    await Promise.all([
      db.customer.count({ where: { companyId } }),
      db.order.count({ where: { companyId, ...inBranch, status: { in: ["PENDING", "CONFIRMED"] } } }),
      lowStockAt(companyId, branchId),
      db.invoice.count({ where: { companyId, ...inBranch, status: { in: ["SENT", "OVERDUE"] } } }),
      db.ticket.count({ where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.project.count({ where: { companyId, status: "ACTIVE" } }),
      // Deals have no branch: the pipeline is always company wide.
      db.deal.aggregate({
        where: { companyId, stage: { in: ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] } },
        _count: { _all: true },
        _sum: { value: true },
      }),
    ]);

  // A product counts once, however many branches are short of it.
  const lowStockCount = new Set(lowStock.map((r) => r.productId)).size;

  return {
    customerCount,
    openOrderCount,
    lowStockCount,
    outstandingInvoiceCount,
    openTicketCount,
    activeProjectCount,
    openDealCount: openDeals._count._all,
    openPipelineValue: openDeals._sum.value ?? 0,
  };
}

export type BusinessSnapshot = Awaited<ReturnType<typeof getBusinessSnapshot>>;

export function formatSnapshotForPrompt(snapshot: BusinessSnapshot, can: (key: ModuleKey) => boolean = () => true) {
  // Only lines about modules this member can open.
  const lines: [ModuleKey, string][] = [
    ["crm", `${snapshot.customerCount} total customers`],
    ["sales", `${snapshot.openOrderCount} open orders (pending or confirmed)`],
    ["inventory", `${snapshot.lowStockCount} products low on stock at one or more branches`],
    ["invoicing", `${snapshot.outstandingInvoiceCount} outstanding invoices (sent or overdue)`],
    ["support", `${snapshot.openTicketCount} open support tickets`],
    ["projects", `${snapshot.activeProjectCount} active projects`],
    ["crm", `${snapshot.openDealCount} open deals in the sales pipeline worth ${formatCurrency(snapshot.openPipelineValue, { cents: false })} (company wide)`],
  ];
  const visible = lines.filter(([key]) => can(key)).map(([, line]) => `- ${line}`);
  return visible.length > 0 ? visible.join("\n") : "- Nothing in this person's role to summarise.";
}
