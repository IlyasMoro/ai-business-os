"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  CustomerSchema,
  ContactSchema,
  type CustomerFormState,
  type ContactFormState,
} from "@/lib/validation/crm";

export async function createCustomer(
  _state: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
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
    return { errors: validated.error.flatten().fieldErrors };
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

export async function updateCustomer(
  customerId: string,
  _state: CustomerFormState,
  formData: FormData
): Promise<CustomerFormState> {
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
    return { errors: validated.error.flatten().fieldErrors };
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

  await db.customer.delete({
    where: { id: customerId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/crm");
  redirect("/dashboard/crm");
}

export async function createContact(
  customerId: string,
  _state: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const session = await verifySession();

  const validated = ContactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const customer = await db.customer.findUnique({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) {
    return { message: "Customer not found." };
  }

  const { email, ...rest } = validated.data;

  await db.contact.create({
    data: { ...rest, email: email || undefined, customerId },
  });

  revalidatePath(`/dashboard/crm/${customerId}`);
  return undefined;
}

export async function deleteContact(customerId: string, contactId: string) {
  const session = await verifySession();

  await db.contact.delete({
    where: { id: contactId, customer: { companyId: session.companyId } },
  });

  revalidatePath(`/dashboard/crm/${customerId}`);
}
