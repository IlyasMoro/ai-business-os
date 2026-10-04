"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { CustomerSchema, ContactSchema } from "@/lib/validation/crm";
import type { LeadSource } from "@/generated/prisma/client";
import { readCustomValues } from "@/lib/custom-fields";
import { customerScope } from "@/lib/crm-access";
import { touchLeadScore } from "@/lib/lead-score-data";
import { fireRules } from "@/lib/crm-rules-runner";

/** Whether a user belongs to this company, before making them an owner or assignee. */
async function isCompanyUser(companyId: string, userId: string) {
  return Boolean(await db.user.findFirst({ where: { id: userId, companyId }, select: { id: true } }));
}

/** The tags ticked on the customer form (only this company's) and the
 * custom field values, with the labels of any that are invalid. */
async function readExtras(companyId: string, formData: FormData) {
  const tickedIds = formData.getAll("tagIds").filter((v): v is string => typeof v === "string");
  const [tags, fields] = await Promise.all([
    tickedIds.length
      ? db.customerTag.findMany({ where: { companyId, id: { in: tickedIds } }, select: { id: true } })
      : Promise.resolve([]),
    db.customField.findMany({ where: { companyId }, select: { id: true, label: true, type: true, options: true } }),
  ]);
  const { values, invalid } = readCustomValues(fields, (name) => {
    const v = formData.get(name);
    return typeof v === "string" ? v : null;
  });
  return { tagIds: tags.map((t) => t.id), customFields: values, invalid };
}

export async function createCustomer(formData: FormData) {
  const session = await verifySession();

  const validated = CustomerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    status: formData.get("status"),
    notes: formData.get("notes"),
    campaignId: formData.get("campaignId") || undefined,
    source: formData.get("source") ?? undefined,
    ownerId: formData.get("ownerId") || undefined,
    creditLimit: formData.get("creditLimit") || undefined,
  });

  if (!validated.success) {
    redirect("/dashboard/crm/new?error=invalid");
  }

  const { email, campaignId, creditLimit, source, ownerId, ...rest } = validated.data;
  if (ownerId && !(await isCompanyUser(session.companyId, ownerId))) redirect("/dashboard/crm/new?error=invalid");
  const extras = await readExtras(session.companyId, formData);
  if (extras.invalid.length) redirect("/dashboard/crm/new?error=custom-field-invalid");

  if (campaignId) {
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId, companyId: session.companyId },
      select: { id: true },
    });
    if (!campaign) redirect("/dashboard/crm/new?error=invalid");
  }

  const customer = await db.customer.create({
    data: {
      ...rest,
      email: email || undefined,
      campaignId: campaignId || undefined,
      source: source ? (source as LeadSource) : undefined,
      // The person who adds a customer looks after it unless someone else is chosen.
      ownerId: ownerId || session.userId,
      creditLimit: creditLimit === "" || creditLimit === undefined ? undefined : creditLimit,
      companyId: session.companyId,
      customFields: extras.customFields,
      tags: { connect: extras.tagIds.map((id) => ({ id })) },
    },
  });
  await touchLeadScore(session.companyId, customer.id);
  if (customer.status === "LEAD") {
    await fireRules({ trigger: "NEW_LEAD", companyId: session.companyId, customerId: customer.id, key: `customer:${customer.id}` });
  }

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
    campaignId: formData.get("campaignId") || undefined,
    source: formData.get("source") ?? undefined,
    ownerId: formData.get("ownerId") || undefined,
    creditLimit: formData.get("creditLimit") || undefined,
  });

  if (!validated.success) {
    redirect(`/dashboard/crm/${customerId}/edit?error=invalid`);
  }

  const { email, campaignId, creditLimit, source, ownerId, ...rest } = validated.data;
  if (ownerId && !(await isCompanyUser(session.companyId, ownerId))) redirect(`/dashboard/crm/${customerId}/edit?error=invalid`);
  const visible = await db.customer.findFirst({ where: { id: customerId, companyId: session.companyId, ...(await customerScope()) }, select: { id: true } });
  if (!visible) redirect("/dashboard/crm?error=forbidden");
  const extras = await readExtras(session.companyId, formData);
  if (extras.invalid.length) redirect(`/dashboard/crm/${customerId}/edit?error=custom-field-invalid`);

  if (campaignId) {
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId, companyId: session.companyId },
      select: { id: true },
    });
    if (!campaign) redirect(`/dashboard/crm/${customerId}/edit?error=invalid`);
  }

  await db.customer.update({
    where: { id: customerId, companyId: session.companyId },
    data: {
      ...rest,
      email: email || null,
      campaignId: campaignId || null,
      source: source ? (source as LeadSource) : null,
      ownerId: ownerId || null,
      creditLimit: creditLimit === "" || creditLimit === undefined ? null : creditLimit,
      customFields: extras.customFields,
      tags: { set: extras.tagIds.map((id) => ({ id })) },
    },
  });
  await touchLeadScore(session.companyId, customerId);

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

  const customer = await db.customer.findFirst({
    where: { id: customerId, companyId: session.companyId, ...(await customerScope()) },
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
