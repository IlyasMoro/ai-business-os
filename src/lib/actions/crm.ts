"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { CustomerSchema, ContactSchema } from "@/lib/validation/crm";

export async function createCustomer(formData: FormData) {
  const session = await verifySession();

  const validated = CustomerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!validated.success) {
    redirect("/dashboard/crm/new?error=invalid");
  }

  const { email, ...rest } = validated.data;

  const customer = await db.customer.create({
    data: {
      ...rest,
      email: email || undefined,
      companyId: session.companyId,
    },
  });

  revalidatePath("/dashboard/crm");
  redirect(`/dashboard/crm/${customer.id}`);
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const session = await verifySession();

  const validated = CustomerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!validated.success) {
    redirect(`/dashboard/crm/${customerId}/edit?error=invalid`);
  }

  const { email, ...rest } = validated.data;

  await db.customer.update({
    where: { id: customerId, companyId: session.companyId },
    data: { ...rest, email: email || null },
  });

  revalidatePath("/dashboard/crm");
  revalidatePath(`/dashboard/crm/${customerId}`);
  redirect(`/dashboard/crm/${customerId}`);
}

export async function deleteCustomer(customerId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/crm?error=forbidden");
  }

  await db.customer.delete({
    where: { id: customerId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/crm");
  redirect("/dashboard/crm");
}

export async function createContact(customerId: string, formData: FormData) {
  const session = await verifySession();

  const validated = ContactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  });

  if (!validated.success) {
    redirect(`/dashboard/crm/${customerId}?error=invalid`);
  }

  const customer = await db.customer.findUnique({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    redirect(`/dashboard/crm/${customerId}?error=invalid`);
  }

  const { email, ...rest } = validated.data;

  await db.contact.create({
    data: { ...rest, email: email || undefined, customerId },
  });

  revalidatePath(`/dashboard/crm/${customerId}`);
  redirect(`/dashboard/crm/${customerId}`);
}

export async function deleteContact(customerId: string, contactId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect(`/dashboard/crm/${customerId}?error=forbidden`);
  }

  await db.contact.delete({
    where: { id: contactId, customer: { companyId: session.companyId } },
  });

  revalidatePath(`/dashboard/crm/${customerId}`);
}
