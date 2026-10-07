import "server-only";
import { balanceDue } from "@/lib/invoice-rules";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { customerScope, dealScope } from "@/lib/crm-access";
import { isOpenStage, pipelineSummary, stageInfo } from "@/lib/crm-pipeline";
import { closedIn, forecastByMonth, openByStage, periodRange } from "@/lib/sales-report";
import { getCampaignsWithStats } from "@/lib/campaign-data";
import { totalStats } from "@/lib/campaign-stats";
import {
  FindCustomerArgs,
  CreateTaskArgs,
  UpdateTicketStatusArgs,
  UpdateTicketPriorityArgs,
  UpdateCustomerStatusArgs,
  SummarizeSalesArgs,
  PipelineReportArgs,
  CampaignReportArgs,
  CreateInvoiceArgs,
  SendOverdueReminderArgs,
  summarizeCreateTask,
  summarizeUpdateTicketStatus,
  summarizeUpdateTicketPriority,
  summarizeUpdateCustomerStatus,
  summarizeCreateInvoice,
  summarizeSendOverdueReminder,
} from "@/lib/validation/ai-actions";

export {
  TOOL_DEFINITIONS,
  isReadTool,
  isKnownTool,
  CustomerStatusValues,
} from "@/lib/validation/ai-actions";

// ---------- Read-tool executors ----------

/** branchId: the branch in the user's switcher; orders, invoices and income follow it. */
export async function runReadTool(companyId: string, name: string, rawArgs: unknown, branchId: string | null = null): Promise<unknown> {
  const inBranch = branchId ? { branchId } : {};
  switch (name) {
    case "find_customer": {
      const parsed = FindCustomerArgs.safeParse(rawArgs);
      if (!parsed.success) return { error: "Invalid arguments for find_customer." };
      const customers = await db.customer.findMany({
        where: {
          companyId,
          // An employee limited to their own customers only finds those.
          ...(await customerScope()),
          OR: [
            { name: { contains: parsed.data.query, mode: "insensitive" } },
            { email: { contains: parsed.data.query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true, status: true, leadScore: true, tags: { select: { name: true } } },
        take: 5,
      });
      return { customers };
    }
    case "list_open_tickets": {
      const tickets = await db.ticket.findMany({
        where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { id: true, subject: true, priority: true, status: true, customer: { select: { name: true } } },
        take: 20,
      });
      return {
        tickets: tickets.map((t) => ({
          id: t.id,
          subject: t.subject,
          priority: t.priority,
          status: t.status,
          customerName: t.customer.name,
        })),
      };
    }
    case "list_overdue_invoices": {
      const invoices = await db.invoice.findMany({
        where: { companyId, ...inBranch, status: { in: ["SENT", "OVERDUE"] } },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          amountPaid: true,
          amountCredited: true,
          dueDate: true,
          customerId: true,
          customer: { select: { name: true } },
        },
        take: 20,
      });
      return {
        invoices: invoices.map((i) => ({
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          totalAmount: i.totalAmount,
          // What's still owed after part payments and credit notes.
          balanceDue: balanceDue(i),
          dueDate: i.dueDate.toISOString().slice(0, 10),
          customerId: i.customerId,
          customerName: i.customer.name,
        })),
      };
    }
    case "list_projects": {
      const projects = await db.project.findMany({
        where: { companyId, status: "ACTIVE" },
        select: { id: true, name: true },
        take: 20,
      });
      return { projects };
    }
    case "summarize_sales": {
      const parsed = SummarizeSalesArgs.safeParse(rawArgs);
      if (!parsed.success) return { error: "Invalid arguments for summarize_sales." };
      const period = parsed.data.period ?? "this_month";
      const monthsAgo = period === "last_month" ? 1 : 0;
      const start = startOfMonth(subMonths(new Date(), monthsAgo));
      const end = endOfMonth(subMonths(new Date(), monthsAgo));

      const orders = await db.order.findMany({
        where: { companyId, ...inBranch, createdAt: { gte: start, lte: end } },
        select: { totalAmount: true, customer: { select: { name: true } } },
      });
      const totalValue = orders.reduce((s, o) => s + o.totalAmount, 0);
      const byCustomer = new Map<string, number>();
      for (const o of orders) {
        byCustomer.set(o.customer.name, (byCustomer.get(o.customer.name) ?? 0) + o.totalAmount);
      }
      const top = Array.from(byCustomer.entries()).sort((a, b) => b[1] - a[1])[0];

      return {
        period,
        orderCount: orders.length,
        totalOrderValue: totalValue,
        averageOrderValue: orders.length > 0 ? totalValue / orders.length : 0,
        topCustomer: top ? { name: top[0], value: top[1] } : null,
      };
    }
    case "forecast_next_month_revenue": {
      return forecastNextMonthRevenue(companyId, branchId);
    }
    case "pipeline_report": {
      const parsed = PipelineReportArgs.safeParse(rawArgs ?? {});
      if (!parsed.success) return { error: "Invalid arguments for pipeline_report." };
      return pipelineReport(companyId, parsed.data.closing);
    }
    case "campaign_report": {
      const parsed = CampaignReportArgs.safeParse(rawArgs ?? {});
      if (!parsed.success) return { error: "Invalid arguments for campaign_report." };
      return campaignReport(companyId, parsed.data);
    }
    default:
      return { error: `Unknown read tool: ${name}` };
  }
}

/** Campaign results for the Copilot, best revenue first. Company wide:
 * campaigns have no branch. */
async function campaignReport(companyId: string, filter: { name?: string | null; status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | null }) {
  const campaigns = await getCampaignsWithStats(companyId, {
    ...(filter.name ? { name: { contains: filter.name, mode: "insensitive" } } : {}),
    ...(filter.status ? { status: filter.status } : {}),
  });
  const sorted = [...campaigns].sort((a, b) => b.stats.revenue - a.stats.revenue || b.stats.leads - a.stats.leads);
  return {
    note: "Revenue is paid invoices from each campaign's leads, issued on or after its start date. Return on spend is (revenue - spent) / spent and is null until spend is recorded on the campaign.",
    campaignCount: campaigns.length,
    totals: totalStats(campaigns.map((c) => c.stats)),
    campaigns: sorted.slice(0, 15).map((c) => ({
      name: c.name,
      channel: c.channel,
      status: c.status,
      startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
      ...c.stats,
    })),
    link: "/dashboard/marketing",
  };
}

/** The CRM pipeline for the Copilot. Deals have no branch, so this is
 * company wide whatever the switcher says. */
async function pipelineReport(companyId: string, closing?: "this_month" | "next_month" | "this_quarter" | "overdue") {
  const now = new Date();
  const deals = await db.deal.findMany({
    where: { companyId, ...(await dealScope()) },
    select: {
      id: true,
      title: true,
      value: true,
      stage: true,
      probability: true,
      expectedClose: true,
      closedAt: true,
      createdAt: true,
      ownerId: true,
      owner: { select: { name: true } },
      customer: { select: { name: true } },
    },
  });
  const summary = pipelineSummary(deals);
  const quarter = closedIn(deals, periodRange("quarter", now));

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windows = {
    this_month: { start: startOfMonth, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
    next_month: { start: new Date(now.getFullYear(), now.getMonth() + 1, 1), end: new Date(now.getFullYear(), now.getMonth() + 2, 1) },
    this_quarter: periodRange("quarter", now),
    overdue: { start: new Date(0), end: startOfToday },
  };
  const open = deals.filter((d) => isOpenStage(d.stage));
  const matching = closing
    ? open.filter((d) => d.expectedClose && d.expectedClose >= windows[closing].start && d.expectedClose < windows[closing].end)
    : open;
  const listed = matching
    .sort((a, b) => b.value * b.probability - a.value * a.probability)
    .slice(0, 25)
    .map((d) => ({
      id: d.id,
      title: d.title,
      customer: d.customer.name,
      stage: stageInfo(d.stage).label,
      value: d.value,
      chancePercent: d.probability,
      weightedValue: Math.round(d.value * d.probability) / 100,
      expectedClose: d.expectedClose?.toISOString().slice(0, 10) ?? null,
      owner: d.owner?.name ?? null,
    }));

  return {
    today: now.toISOString().slice(0, 10),
    openDeals: summary.openCount,
    openPipelineValue: summary.openValue,
    weightedForecast: summary.weightedValue,
    openByStage: openByStage(deals).map(({ label, count, value }) => ({ stage: label, count, value })),
    forecastByExpectedClose: forecastByMonth(deals, now).map(({ label, count, value, weighted }) => ({ month: label, count, value, weighted })),
    thisQuarter: { won: quarter.wonCount, lost: quarter.lostCount, wonValue: quarter.wonValue, winRatePercent: quarter.winRate },
    filter: closing ?? "largest open deals",
    matchingDealCount: matching.length,
    // Totals worked out here so the model never has to add them up itself.
    matchingTotalValue: Math.round(matching.reduce((s, d) => s + d.value, 0) * 100) / 100,
    matchingWeightedValue: Math.round(matching.reduce((s, d) => s + (d.value * d.probability) / 100, 0) * 100) / 100,
    deals: listed,
    note: "Weighted value is value times chance of winning. Quote matchingTotalValue and matchingWeightedValue as given rather than adding up the deals. Chances are estimates set per deal, so this is a forecast, not a guarantee.",
  };
}

/** Trailing 3-month average of recorded income — a rough trend estimate, not
 * a guarantee. Shared by the AI Copilot's forecast tool and the Reports page. */
export async function forecastNextMonthRevenue(companyId: string, branchId: string | null = null) {
  const months = [2, 1, 0].map((n) => ({
    start: startOfMonth(subMonths(new Date(), n)),
    end: endOfMonth(subMonths(new Date(), n)),
  }));
  const totals = await Promise.all(
    months.map(async ({ start, end }) => {
      const income = await db.transaction.aggregate({
        where: { companyId, type: "INCOME", date: { gte: start, lte: end }, ...(branchId ? { branchId } : {}) },
        _sum: { amount: true },
      });
      return income._sum.amount ?? 0;
    })
  );
  const average = totals.reduce((s, v) => s + v, 0) / totals.length;

  return {
    method: "average of recorded income over the last 3 months (a rough trend estimate, not a guarantee)",
    lastThreeMonthsIncome: totals,
    estimatedNextMonthRevenue: Math.round(average),
  };
}

// ---------- Write-tool proposals ----------

async function getOrCreateAiFollowUpsProject(companyId: string) {
  const existing = await db.project.findFirst({
    // Older companies have the project under its hyphenated name.
    where: { companyId, name: { in: ["AI follow ups", "AI Follow-ups"] } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.project.create({
    data: { companyId, name: "AI follow ups", description: "Follow up tasks suggested by the AI Copilot." },
    select: { id: true },
  });
  return created.id;
}

type ProposeResult = { id: string; summary: string } | { error: string };

export async function proposeAiAction(
  companyId: string,
  requestedByUserId: string,
  chatMessageId: string,
  name: string,
  rawArgs: unknown
): Promise<ProposeResult> {
  switch (name) {
    case "create_task": {
      const parsed = CreateTaskArgs.safeParse(rawArgs);
      if (!parsed.success) return { error: "Invalid arguments for create_task." };

      const projectId = parsed.data.projectId || (await getOrCreateAiFollowUpsProject(companyId));
      const project = await db.project.findUnique({ where: { id: projectId, companyId }, select: { id: true } });
      if (!project) return { error: "projectId does not belong to this company." };

      const summary = summarizeCreateTask(parsed.data);
      const action = await db.aiAction.create({
        data: {
          type: "CREATE_TASK",
          summary,
          input: JSON.stringify({ ...parsed.data, projectId }),
          companyId,
          requestedByUserId,
          chatMessageId,
        },
      });
      return { id: action.id, summary };
    }
    case "update_ticket_status": {
      const parsed = UpdateTicketStatusArgs.safeParse(rawArgs);
      if (!parsed.success) return { error: "Invalid arguments for update_ticket_status." };

      const ticket = await db.ticket.findUnique({
        where: { id: parsed.data.ticketId, companyId },
        select: { id: true, subject: true },
      });
      if (!ticket) return { error: "ticketId does not belong to this company." };

      const summary = summarizeUpdateTicketStatus(ticket.subject, parsed.data.status);
      const action = await db.aiAction.create({
        data: {
          type: "UPDATE_TICKET_STATUS",
          summary,
          input: JSON.stringify(parsed.data),
          companyId,
          requestedByUserId,
          chatMessageId,
        },
      });
      return { id: action.id, summary };
    }
    case "update_ticket_priority": {
      const parsed = UpdateTicketPriorityArgs.safeParse(rawArgs);
      if (!parsed.success) return { error: "Invalid arguments for update_ticket_priority." };

      const ticket = await db.ticket.findUnique({
        where: { id: parsed.data.ticketId, companyId },
        select: { id: true, subject: true },
      });
      if (!ticket) return { error: "ticketId does not belong to this company." };

      const summary = summarizeUpdateTicketPriority(ticket.subject, parsed.data.priority);
      const action = await db.aiAction.create({
        data: {
          type: "UPDATE_TICKET_PRIORITY",
          summary,
          input: JSON.stringify(parsed.data),
          companyId,
          requestedByUserId,
          chatMessageId,
        },
      });
      return { id: action.id, summary };
    }
    case "update_customer_status": {
      const parsed = UpdateCustomerStatusArgs.safeParse(rawArgs);
      if (!parsed.success) return { error: "Invalid arguments for update_customer_status." };

      const customer = await db.customer.findUnique({
        where: { id: parsed.data.customerId, companyId },
        select: { id: true, name: true },
      });
      if (!customer) return { error: "customerId does not belong to this company." };

      const summary = summarizeUpdateCustomerStatus(customer.name, parsed.data.status);
      const action = await db.aiAction.create({
        data: {
          type: "UPDATE_CUSTOMER_STATUS",
          summary,
          input: JSON.stringify(parsed.data),
          companyId,
          requestedByUserId,
          chatMessageId,
        },
      });
      return { id: action.id, summary };
    }
    case "create_invoice": {
      const parsed = CreateInvoiceArgs.safeParse(rawArgs);
      if (!parsed.success) return { error: "Invalid arguments for create_invoice." };

      const customer = await db.customer.findUnique({
        where: { id: parsed.data.customerId, companyId },
        select: { id: true, name: true },
      });
      if (!customer) return { error: "customerId does not belong to this company." };

      const dueDate = new Date(parsed.data.dueDate);
      if (Number.isNaN(dueDate.getTime())) return { error: "Invalid dueDate." };

      const summary = summarizeCreateInvoice(customer.name, parsed.data.dueDate);
      const action = await db.aiAction.create({
        data: {
          type: "CREATE_INVOICE",
          summary,
          input: JSON.stringify(parsed.data),
          companyId,
          requestedByUserId,
          chatMessageId,
        },
      });
      return { id: action.id, summary };
    }
    case "send_overdue_reminder": {
      const parsed = SendOverdueReminderArgs.safeParse(rawArgs);
      if (!parsed.success) return { error: "Invalid arguments for send_overdue_reminder." };

      const customer = await db.customer.findUnique({
        where: { id: parsed.data.customerId, companyId },
        select: { id: true, name: true, email: true },
      });
      if (!customer) return { error: "customerId does not belong to this company." };
      if (!customer.email) return { error: "This customer has no email on file." };

      const summary = summarizeSendOverdueReminder(customer.name);
      const action = await db.aiAction.create({
        data: {
          type: "SEND_OVERDUE_REMINDER",
          summary,
          input: JSON.stringify(parsed.data),
          companyId,
          requestedByUserId,
          chatMessageId,
        },
      });
      return { id: action.id, summary };
    }
    default:
      return { error: `Unknown write tool: ${name}` };
  }
}
