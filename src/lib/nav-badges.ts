import "server-only";
import { db } from "@/lib/db";
import { lowStockAt } from "@/lib/stock";
import type { NavBadges } from "@/components/layout/nav-config";

/**
 * Work waiting behind each menu page, for the count badges: overdue
 * invoices (red), low stock (amber), orders to confirm, deliveries to
 * receive, open tickets and AI proposals to review (blue). Follows the top
 * bar branch switcher where the records belong to a branch. Zero counts
 * are left out so the menu only shows what needs attention.
 */
export async function getNavBadges(companyId: string, viewBranchId: string | null): Promise<NavBadges> {
  const inBranch = viewBranchId ? { branchId: viewBranchId } : {};
  const [overdue, pending, awaiting, tickets, proposals, lowRows] = await Promise.all([
    db.invoice.count({ where: { companyId, ...inBranch, OR: [{ status: "OVERDUE" }, { status: "SENT", dueDate: { lt: new Date() } }] } }),
    db.order.count({ where: { companyId, ...inBranch, status: "PENDING" } }),
    db.purchaseOrder.count({ where: { companyId, ...inBranch, status: "ORDERED" } }),
    db.ticket.count({ where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.aiAction.count({ where: { companyId, status: "PENDING" } }),
    lowStockAt(companyId, viewBranchId),
  ]);

  const badges: NavBadges = {};
  const add = (href: string, count: number, tone: NavBadges[string]["tone"]) => {
    if (count > 0) badges[href] = { count, tone };
  };
  add("/dashboard/invoicing", overdue, "red");
  add("/dashboard/inventory", lowRows.length, "amber");
  add("/dashboard/sales", pending, "blue");
  add("/dashboard/procurement", awaiting, "blue");
  add("/dashboard/support", tickets, "blue");
  add("/dashboard/assistant", proposals, "blue");
  return badges;
}
