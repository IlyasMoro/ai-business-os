import { describe, it, expect } from "vitest";
import {
  FindCustomerArgs,
  CreateTaskArgs,
  UpdateTicketStatusArgs,
  UpdateTicketPriorityArgs,
  UpdateCustomerStatusArgs,
  isKnownTool,
  isReadTool,
  summarizeCreateTask,
  summarizeUpdateTicketStatus,
  summarizeUpdateTicketPriority,
  summarizeUpdateCustomerStatus,
} from "@/lib/validation/ai-actions";

describe("tool argument validation", () => {
  it("accepts valid find_customer args", () => {
    expect(FindCustomerArgs.safeParse({ query: "Acme" }).success).toBe(true);
  });

  it("rejects an empty find_customer query", () => {
    expect(FindCustomerArgs.safeParse({ query: "" }).success).toBe(false);
  });

  it("accepts create_task args with only a title", () => {
    expect(CreateTaskArgs.safeParse({ title: "Follow up" }).success).toBe(true);
  });

  it("rejects create_task args missing a title", () => {
    expect(CreateTaskArgs.safeParse({ description: "no title" }).success).toBe(false);
  });

  it("accepts a known ticket status", () => {
    expect(
      UpdateTicketStatusArgs.safeParse({ ticketId: "t1", status: "RESOLVED" }).success
    ).toBe(true);
  });

  it("rejects an unknown ticket status", () => {
    expect(
      UpdateTicketStatusArgs.safeParse({ ticketId: "t1", status: "NOT_A_STATUS" }).success
    ).toBe(false);
  });

  it("accepts a known ticket priority", () => {
    expect(
      UpdateTicketPriorityArgs.safeParse({ ticketId: "t1", priority: "HIGH" }).success
    ).toBe(true);
  });

  it("rejects an unknown ticket priority", () => {
    expect(
      UpdateTicketPriorityArgs.safeParse({ ticketId: "t1", priority: "URGENT" }).success
    ).toBe(false);
  });

  it("accepts a known customer status", () => {
    expect(
      UpdateCustomerStatusArgs.safeParse({ customerId: "c1", status: "INACTIVE" }).success
    ).toBe(true);
  });

  it("rejects an unknown customer status", () => {
    expect(
      UpdateCustomerStatusArgs.safeParse({ customerId: "c1", status: "VIP" }).success
    ).toBe(false);
  });
});

describe("tool name classification", () => {
  it("recognizes read tools", () => {
    expect(isReadTool("find_customer")).toBe(true);
    expect(isReadTool("list_open_tickets")).toBe(true);
  });

  it("does not classify write tools as read tools", () => {
    expect(isReadTool("create_task")).toBe(false);
  });

  it("recognizes all defined tools as known", () => {
    expect(isKnownTool("create_task")).toBe(true);
    expect(isKnownTool("update_customer_status")).toBe(true);
  });

  it("rejects an unrecognized tool name", () => {
    expect(isKnownTool("delete_everything")).toBe(false);
  });
});

describe("summary formatters", () => {
  it("summarizes a task without a due date", () => {
    expect(summarizeCreateTask({ title: "Call Acme Corp" })).toBe('Create task "Call Acme Corp"');
  });

  it("summarizes a task with a due date", () => {
    expect(summarizeCreateTask({ title: "Call Acme Corp", dueDate: "2026-07-15" })).toBe(
      'Create task "Call Acme Corp" due 2026-07-15'
    );
  });

  it("summarizes a ticket status change", () => {
    expect(summarizeUpdateTicketStatus("Order not delivered", "RESOLVED")).toBe(
      'Set ticket "Order not delivered" status to RESOLVED'
    );
  });

  it("summarizes a ticket priority change", () => {
    expect(summarizeUpdateTicketPriority("Order not delivered", "HIGH")).toBe(
      'Set ticket "Order not delivered" priority to HIGH'
    );
  });

  it("summarizes a customer status change", () => {
    expect(summarizeUpdateCustomerStatus("Acme Corp", "INACTIVE")).toBe(
      'Set customer "Acme Corp" status to INACTIVE'
    );
  });
});
