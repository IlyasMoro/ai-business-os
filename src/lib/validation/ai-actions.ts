import * as z from "zod";
import type { Groq } from "groq-sdk";
import { TicketStatusValues, TicketPriorityValues } from "@/lib/validation/support";

export const CustomerStatusValues = ["LEAD", "ACTIVE", "INACTIVE"] as const;
export const SalesPeriodValues = ["this_month", "last_month"] as const;

// ---------- Tool definitions (Groq / OpenAI-compatible function schema) ----------

export const TOOL_DEFINITIONS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "find_customer",
      description:
        "Search for a customer by name or email. Returns matching customers with their id, name, and status. Use this before proposing any action that targets a specific customer.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name or email to search for." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_open_tickets",
      description: "List open or in-progress support tickets, with their id, subject, priority, and customer name.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_overdue_invoices",
      description: "List invoices that are sent or overdue and still unpaid, with id, invoice number, customer name, and amount.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List active projects with their id and name, so a task can be attached to one.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Propose creating a follow-up task. This does not create the task immediately — it submits a proposal that a human must approve first.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title." },
          description: { type: "string", description: "Optional extra detail." },
          dueDate: { type: "string", description: "Optional due date, YYYY-MM-DD." },
          projectId: {
            type: "string",
            description: "Optional id of an existing project (from list_projects) to attach the task to.",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_ticket_status",
      description: "Propose changing a support ticket's status. Requires a ticket id from list_open_tickets.",
      parameters: {
        type: "object",
        properties: {
          ticketId: { type: "string" },
          status: { type: "string", enum: [...TicketStatusValues] },
        },
        required: ["ticketId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_ticket_priority",
      description: "Propose changing a support ticket's priority. Requires a ticket id from list_open_tickets.",
      parameters: {
        type: "object",
        properties: {
          ticketId: { type: "string" },
          priority: { type: "string", enum: [...TicketPriorityValues] },
        },
        required: ["ticketId", "priority"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_customer_status",
      description: "Propose changing a customer's status (e.g. flagging as inactive). Requires a customer id from find_customer.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          status: { type: "string", enum: [...CustomerStatusValues] },
        },
        required: ["customerId", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_sales",
      description:
        "Get a summary of sales for a period: number of orders, total order value, average order value, and the top customer by order value. Read-only, runs immediately.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: [...SalesPeriodValues],
            description: "Defaults to this_month if omitted.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forecast_next_month_revenue",
      description:
        "Estimate next month's revenue using a trailing 3-month average of recorded income. This is a rough trend estimate, not a guarantee — say so when reporting it. Read-only, runs immediately.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_invoice",
      description:
        "Propose creating a new draft invoice for a customer. Requires a customer id from find_customer.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          dueDate: { type: "string", description: "Due date, YYYY-MM-DD." },
        },
        required: ["customerId", "dueDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_overdue_reminder",
      description:
        "Propose emailing a customer a reminder about their overdue/outstanding invoices. Requires a customer id — from find_customer or list_overdue_invoices.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
        },
        required: ["customerId"],
      },
    },
  },
];

const READ_TOOL_NAMES = new Set([
  "find_customer",
  "list_open_tickets",
  "list_overdue_invoices",
  "list_projects",
  "summarize_sales",
  "forecast_next_month_revenue",
]);

export function isReadTool(name: string) {
  return READ_TOOL_NAMES.has(name);
}

export function isKnownTool(name: string) {
  return TOOL_DEFINITIONS.some((tool) => tool.function?.name === name);
}

// ---------- Argument validation ----------

export const FindCustomerArgs = z.object({ query: z.string().min(1) });
export const CreateTaskArgs = z.object({
  title: z.string().min(1),
  description: z.string().trim().optional(),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "dueDate must be YYYY-MM-DD." })
    .optional(),
  projectId: z.string().trim().optional(),
});
export const UpdateTicketStatusArgs = z.object({
  ticketId: z.string().min(1),
  status: z.enum(TicketStatusValues),
});
export const UpdateTicketPriorityArgs = z.object({
  ticketId: z.string().min(1),
  priority: z.enum(TicketPriorityValues),
});
export const UpdateCustomerStatusArgs = z.object({
  customerId: z.string().min(1),
  status: z.enum(CustomerStatusValues),
});
export const SummarizeSalesArgs = z.object({
  period: z.enum(SalesPeriodValues).optional(),
});
export const CreateInvoiceArgs = z.object({
  customerId: z.string().min(1),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "dueDate must be YYYY-MM-DD." }),
});
export const SendOverdueReminderArgs = z.object({
  customerId: z.string().min(1),
});

// ---------- Summary formatters ----------

export function summarizeCreateTask(args: { title: string; dueDate?: string }) {
  return `Create task "${args.title}"${args.dueDate ? ` due ${args.dueDate}` : ""}`;
}

export function summarizeUpdateTicketStatus(subject: string, status: string) {
  return `Set ticket "${subject}" status to ${status}`;
}

export function summarizeUpdateTicketPriority(subject: string, priority: string) {
  return `Set ticket "${subject}" priority to ${priority}`;
}

export function summarizeUpdateCustomerStatus(name: string, status: string) {
  return `Set customer "${name}" status to ${status}`;
}

export function summarizeCreateInvoice(customerName: string, dueDate: string) {
  return `Create a draft invoice for "${customerName}" due ${dueDate}`;
}

export function summarizeSendOverdueReminder(customerName: string) {
  return `Email "${customerName}" a reminder about their overdue invoice(s)`;
}
