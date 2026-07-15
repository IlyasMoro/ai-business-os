import "server-only";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";
import { db } from "@/lib/db";
import {
  FindCustomerArgs,
  CreateTaskArgs,
  UpdateTicketStatusArgs,
  UpdateTicketPriorityArgs,
  UpdateCustomerStatusArgs,
  SummarizeSalesArgs,
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

export async function runReadTool(companyId: string, name: string, rawArgs: unknown): Promise<unknown> {
  switch (name) {
    case "find_customer": {
      const parsed = FindCustomerArgs.safeParse(rawArgs);
      if (!parsed.success) return { error: "Invalid arguments for find_customer." };
      const customers = await db.customer.findMany({
        where: {
          companyId,
          OR: [
            { name: { contains: parsed.data.query } },
            { email: { contains: parsed.data.query } },
          ],
        },
        select: { id: true, name: true, email: true, status: true },
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
        where: { companyId, status: { in: ["SENT", "OVERDUE"] } },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
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
        where: { companyId, createdAt: { gte: start, lte: end } },
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
      return forecastNextMonthRevenue(companyId);
    }
    default:
      return { error: `Unknown read tool: ${name}` };
  }
}

/** Trailing 3-month average of recorded income — a rough trend estimate, not
 * a guarantee. Shared by the AI Copilot's forecast tool and the Reports page. */
export async function forecastNextMonthRevenue(companyId: string) {
  const months = [2, 1, 0].map((n) => ({
    start: startOfMonth(subMonths(new Date(), n)),
    end: endOfMonth(subMonths(new Date(), n)),
  }));
  const totals = await Promise.all(
    months.map(async ({ start, end }) => {
      const income = await db.transaction.aggregate({
        where: { companyId, type: "INCOME", date: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      return income._sum.amount ?? 0;
    })
  );
  const average = totals.reduce((s, v) => s + v, 0) / totals.length;

  return {
    method: "trailing 3-month average of recorded income transactions (a rough trend estimate, not a guarantee)",
    lastThreeMonthsIncome: totals,
    estimatedNextMonthRevenue: Math.round(average),
  };
}

// ---------- Write-tool proposals ----------

async function getOrCreateAiFollowUpsProject(companyId: string) {
  const existing = await db.project.findFirst({
    where: { companyId, name: "AI Follow-ups" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.project.create({
    data: { companyId, name: "AI Follow-ups", description: "Follow-up tasks proposed by the AI assistant." },
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
