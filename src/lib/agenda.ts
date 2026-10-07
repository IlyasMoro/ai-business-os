import "server-only";
import { db } from "@/lib/db";

export type AgendaItem = {
  id: string;
  date: Date;
  title: string;
  subtitle?: string;
  kind: "event" | "invoice" | "task" | "project" | "payroll" | "reminder" | "deal";
  href?: string;
  deletable?: boolean;
};

/** Every dated item across the business: calendar events, invoice due
 * dates, task due dates, project due dates, draft payroll periods, open CRM
 * reminders and the expected close dates of open deals.
 * Shared by the Calendar page (shows everything) and the dashboard
 * Overview page (filters to what's coming up soon). */
export async function getAgendaItems(companyId: string): Promise<AgendaItem[]> {
  const [events, invoices, tasks, projects, payrollRuns, reminders, deals] = await Promise.all([
    db.calendarEvent.findMany({
      where: { companyId },
      orderBy: { startAt: "asc" },
    }),
    db.invoice.findMany({
      where: { companyId, status: { in: ["SENT", "OVERDUE"] } },
      include: { customer: { select: { name: true } } },
    }),
    db.task.findMany({
      where: {
        project: { companyId },
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { not: null },
      },
      include: { project: { select: { id: true, name: true } } },
    }),
    db.project.findMany({
      where: { companyId, status: "ACTIVE", dueDate: { not: null } },
    }),
    db.payrollRun.findMany({
      where: { companyId, status: "DRAFT" },
    }),
    db.followUp.findMany({
      where: { companyId, doneAt: null },
      include: { customer: { select: { id: true, name: true } }, assignee: { select: { name: true } } },
    }),
    db.deal.findMany({
      where: { companyId, stage: { in: ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] }, expectedClose: { not: null } },
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const items: AgendaItem[] = [
    ...events.map((e) => ({
      id: e.id,
      date: e.startAt,
      title: e.title,
      subtitle: e.description ?? undefined,
      kind: "event" as const,
      deletable: true,
    })),
    ...invoices.map((i) => ({
      id: i.id,
      date: i.dueDate,
      title: `${i.invoiceNumber} · ${i.customer.name}`,
      subtitle: `$${i.totalAmount.toFixed(2)}`,
      kind: "invoice" as const,
      href: `/dashboard/invoicing/${i.id}`,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      date: t.dueDate!,
      title: t.title,
      subtitle: t.project.name,
      kind: "task" as const,
      href: `/dashboard/projects/${t.project.id}`,
    })),
    ...projects.map((p) => ({
      id: p.id,
      date: p.dueDate!,
      title: p.name,
      kind: "project" as const,
      href: `/dashboard/projects/${p.id}`,
    })),
    ...payrollRuns.map((r) => ({
      id: r.id,
      date: r.periodEnd,
      title: `Payroll period ending ${r.periodEnd.toLocaleDateString()}`,
      kind: "payroll" as const,
      href: `/dashboard/payroll/${r.id}`,
    })),
    ...reminders.map((f) => ({
      id: f.id,
      date: f.dueAt,
      title: f.title,
      subtitle: [f.customer.name, f.assignee?.name].filter(Boolean).join(" · "),
      kind: "reminder" as const,
      href: `/dashboard/crm/${f.customer.id}`,
    })),
    ...deals.map((d) => ({
      id: d.id,
      date: d.expectedClose!,
      title: d.title,
      subtitle: `${d.customer.name} · $${Math.round(d.value).toLocaleString("en-US")}`,
      kind: "deal" as const,
      href: `/dashboard/crm/deals/${d.id}`,
    })),
  ];

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
