"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  TicketSchema,
  TicketStatusValues,
  TicketMessageSchema,
  type TicketFormState,
  type TicketMessageFormState,
} from "@/lib/validation/support";
import { suggestTicketPriority } from "@/lib/ai-categorize";

export async function suggestPriority(subject: string, description: string) {
  await verifySession();

  if (!subject.trim() && !description.trim()) return null;

  try {
    return await suggestTicketPriority(subject, description);
  } catch {
    return null;
  }
}

export async function createTicket(
  _state: TicketFormState,
  formData: FormData
): Promise<TicketFormState> {
  const session = await verifySession();

  const validated = TicketSchema.safeParse({
    customerId: formData.get("customerId"),
    subject: formData.get("subject"),
    description: formData.get("description"),
    priority: formData.get("priority"),
    assigneeId: formData.get("assigneeId"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { customerId, subject, description, priority, assigneeId } = validated.data;

  const customer = await db.customer.findUnique({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    return { errors: { customerId: ["Select a valid customer."] } };
  }

  if (assigneeId) {
    const employee = await db.employee.findUnique({
      where: { id: assigneeId, companyId: session.companyId },
      select: { id: true },
    });
    if (!employee) {
      return { errors: { assigneeId: ["Select a valid assignee."] } };
    }
  }

  const ticket = await db.ticket.create({
    data: {
      customerId,
      subject,
      description: description || undefined,
      priority,
      assigneeId: assigneeId || undefined,
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/support");
  redirect(`/dashboard/support/${ticket.id}`);
}

export async function updateTicket(
  ticketId: string,
  _state: TicketFormState,
  formData: FormData
): Promise<TicketFormState> {
  const session = await verifySession();

  const validated = TicketSchema.safeParse({
    customerId: formData.get("customerId"),
    subject: formData.get("subject"),
    description: formData.get("description"),
    priority: formData.get("priority"),
    assigneeId: formData.get("assigneeId"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { customerId, subject, description, priority, assigneeId } = validated.data;

  const customer = await db.customer.findUnique({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    return { errors: { customerId: ["Select a valid customer."] } };
  }

  if (assigneeId) {
    const employee = await db.employee.findUnique({
      where: { id: assigneeId, companyId: session.companyId },
      select: { id: true },
    });
    if (!employee) {
      return { errors: { assigneeId: ["Select a valid assignee."] } };
    }
  }

  await db.ticket.update({
    where: { id: ticketId, companyId: session.companyId },
    data: {
      customerId,
      subject,
      description: description || null,
      priority,
      assigneeId: assigneeId || null,
    },
  });

  revalidatePath("/dashboard/support");
  revalidatePath(`/dashboard/support/${ticketId}`);
  redirect(`/dashboard/support/${ticketId}`);
}

export async function addTicketMessage(
  ticketId: string,
  _state: TicketMessageFormState,
  formData: FormData
): Promise<TicketMessageFormState> {
  const session = await verifySession();

  const validated = TicketMessageSchema.safeParse({
    content: formData.get("content"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId, companyId: session.companyId },
    select: { id: true },
  });
  if (!ticket) {
    return { message: "Ticket not found." };
  }

  await db.ticketMessage.create({
    data: {
      ticketId,
      content: validated.data.content,
      authorType: "STAFF",
      authorId: session.userId,
    },
  });

  revalidatePath(`/dashboard/support/${ticketId}`);
  return undefined;
}

export async function deleteTicketMessage(ticketId: string, messageId: string) {
  const session = await verifySession();

  await db.ticketMessage.delete({
    where: { id: messageId, ticket: { companyId: session.companyId } },
  });

  revalidatePath(`/dashboard/support/${ticketId}`);
}

export async function updateTicketStatus(ticketId: string, formData: FormData) {
  const session = await verifySession();

  const status = formData.get("status");
  if (
    typeof status !== "string" ||
    !TicketStatusValues.includes(status as (typeof TicketStatusValues)[number])
  ) {
    return;
  }

  await db.ticket.update({
    where: { id: ticketId, companyId: session.companyId },
    data: { status: status as (typeof TicketStatusValues)[number] },
  });

  revalidatePath(`/dashboard/support/${ticketId}`);
  revalidatePath("/dashboard/support");
}

export async function deleteTicket(ticketId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/support?error=forbidden");
  }

  await db.ticket.delete({
    where: { id: ticketId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/support");
  redirect("/dashboard/support");
}
