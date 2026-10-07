import Link from "next/link";
import { startOfDay, endOfDay } from "date-fns";
import { ArrowRightLeft, BellRing, Boxes, CheckSquare, FileText, LifeBuoy, ShoppingCart, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { lowStockAt } from "@/lib/stock";
import { branchWhere } from "@/lib/branches";
import { formatDayMonth } from "@/lib/utils";
import type { ModuleKey } from "@/lib/role-access";
import { KpiCard } from "@/components/dash-viz/kpi-card";
import { VIZ } from "@/components/dash-viz/colors";

type WorkItem = { id: string; title: string; detail: string; href: string; due: Date | null; icon: LucideIcon };

/**
 * The dashboard for people whose role leaves out the company books (a
 * cashier, a butcher, a stock controller): their own work and their
 * branch's, never company revenue, costs or profit. Every tile and list
 * only appears when the member can open the module behind it.
 */
export async function MyWorkDashboard({
  companyId,
  userId,
  email,
  firstName,
  can,
}: {
  companyId: string;
  userId: string;
  email: string;
  firstName: string;
  can: (key: ModuleKey) => boolean;
}) {
  const inBranch = await branchWhere();
  const now = new Date();
  // Tasks and tickets are given to employees; this person's employee record has their email.
  const employee = await db.employee.findFirst({ where: { companyId, email: { equals: email, mode: "insensitive" } }, select: { id: true } });

  const [ordersToday, openOrders, lowStock, incoming, followUps, tasks, tickets, quotes] = await Promise.all([
    can("sales") ? db.order.count({ where: { companyId, ...inBranch, createdAt: { gte: startOfDay(now), lte: endOfDay(now) } } }) : null,
    can("sales") ? db.order.count({ where: { companyId, ...inBranch, status: { in: ["PENDING", "CONFIRMED"] } } }) : null,
    can("inventory") ? lowStockAt(companyId, inBranch.branchId ?? null) : null,
    can("transfers")
      ? db.stockTransfer.count({ where: { companyId, status: "SENT", ...(inBranch.branchId ? { toBranchId: inBranch.branchId } : {}) } })
      : null,
    can("crm")
      ? db.followUp.findMany({
          where: { companyId, assigneeId: userId, doneAt: null },
          orderBy: { dueAt: "asc" },
          take: 6,
          select: { id: true, title: true, dueAt: true, customer: { select: { id: true, name: true } } },
        })
      : [],
    can("projects") && employee
      ? db.task.findMany({
          where: { assigneeId: employee.id, status: { not: "DONE" }, project: { companyId } },
          orderBy: [{ dueDate: "asc" }],
          take: 6,
          select: { id: true, title: true, dueDate: true, project: { select: { id: true, name: true } } },
        })
      : [],
    can("support") && employee
      ? db.ticket.findMany({
          where: { companyId, assigneeId: employee.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
          orderBy: { createdAt: "asc" },
          take: 6,
          select: { id: true, subject: true, createdAt: true, customer: { select: { name: true } } },
        })
      : [],
    can("quotes")
      ? db.quote.findMany({
          where: { companyId, ownerId: userId, status: { in: ["DRAFT", "SENT"] } },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, quoteNumber: true, validUntil: true, status: true, customer: { select: { name: true } } },
        })
      : [],
  ]);
  const lowStockCount = lowStock ? new Set(lowStock.map((r) => r.productId)).size : null;
  const tileCount = [ordersToday, openOrders, lowStockCount, incoming].filter((v) => v !== null).length;
  // Tiles fill the row whatever the role shows: no empty slot at the end.
  const tileGrid = ["", "", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-2 lg:grid-cols-4"][tileCount];

  const work: WorkItem[] = [
    ...followUps.map((f) => ({ id: `f-${f.id}`, title: f.title, detail: `Follow up · ${f.customer.name}`, href: `/dashboard/crm/${f.customer.id}`, due: f.dueAt, icon: BellRing })),
    ...tasks.map((t) => ({ id: `t-${t.id}`, title: t.title, detail: `Task · ${t.project.name}`, href: `/dashboard/projects/${t.project.id}/tasks/${t.id}`, due: t.dueDate, icon: CheckSquare })),
    ...tickets.map((t) => ({ id: `s-${t.id}`, title: t.subject, detail: `Support ticket · ${t.customer.name}`, href: `/dashboard/support/${t.id}`, due: null, icon: LifeBuoy })),
    ...quotes.map((q) => ({
      id: `q-${q.id}`,
      title: `Quote ${q.quoteNumber}`,
      detail: `${q.status === "DRAFT" ? "Draft, not sent yet" : "Waiting for the customer"} · ${q.customer.name}`,
      href: `/dashboard/quotes/${q.id}`,
      due: q.validUntil,
      icon: FileText,
    })),
  ].sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));

  const hour = Number(now.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Africa/Johannesburg" }));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="mt-2">
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">Your work and your branch today.</p>
      </div>

      {tileCount > 0 && <div className={`mt-6 grid grid-cols-1 gap-4 ${tileGrid}`}>
        {ordersToday !== null && <KpiCard label="Orders today" value={ordersToday} icon={ShoppingCart} color={VIZ.blue} href="/dashboard/sales" hint="Taken at your branch" />}
        {openOrders !== null && (
          <KpiCard label="Orders to finish" value={openOrders} icon={ShoppingCart} color={VIZ.amber} href="/dashboard/sales" hint="Pending or confirmed" />
        )}
        {lowStockCount !== null && (
          <KpiCard label="Low stock items" value={lowStockCount} icon={Boxes} color={lowStockCount > 0 ? VIZ.red : VIZ.emerald} href="/dashboard/inventory" hint="At or below the reorder level" />
        )}
        {incoming !== null && (
          <KpiCard label="Stock on its way" value={incoming} icon={ArrowRightLeft} color={VIZ.emerald} href="/dashboard/transfers" hint="Transfers to receive" />
        )}
      </div>}

      <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
        <h2 className="text-sm font-semibold text-slate-50 light:text-slate-900">Your to do list</h2>
        {work.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400 light:text-slate-500">Nothing is waiting on you. Follow ups, tasks, tickets and quotes given to you will show here.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06] light:divide-slate-200">
            {work.map((item) => {
              const late = item.due !== null && item.due < startOfDay(now);
              return (
                <li key={item.id}>
                  <Link href={item.href} className="flex items-center gap-3 py-3 transition-colors hover:opacity-80">
                    <item.icon className={`h-4 w-4 shrink-0 ${late ? "text-red-400" : "text-slate-400"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-50 light:text-slate-900">{item.title}</span>
                      <span className="block truncate text-xs text-slate-400 light:text-slate-500">{item.detail}</span>
                    </span>
                    {item.due && (
                      <span className={`shrink-0 text-xs tabular-nums ${late ? "font-medium text-red-400 light:text-red-600" : "text-slate-400 light:text-slate-500"}`}>
                        {late ? "Late · " : "Due "}
                        {formatDayMonth(item.due)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
