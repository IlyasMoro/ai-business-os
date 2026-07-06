"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  TicketSchema,
  TicketStatusValues,
  type TicketFormState,
} from "@/lib/validation/support";

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
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { customerId, subject, description, priority } = validated.data;

  const customer = await db.customer.findUnique({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    return { errors: { customerId: ["Select a valid customer."] } };
  }

  const ticket = await db.ticket.create({
    data: {
      customerId,
      subject,
      description: description || undefined,
      priority,
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
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { customerId, subject, description, priority } = validated.data;

  const customer = await db.customer.findUnique({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    return { errors: { customerId: ["Select a valid customer."] } };
  }

  await db.ticket.update({
    where: { id: ticketId, companyId: session.companyId },
    data: {
      customerId,
      subject,
      description: description || null,
      priority,
    },
  });

  revalidatePath("/dashboard/support");
  revalidatePath(`/dashboard/support/${ticketId}`);
  redirect(`/dashboard/support/${ticketId}`);
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
