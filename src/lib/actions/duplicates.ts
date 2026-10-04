"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { asCustomValues } from "@/lib/custom-fields";
import { groupKey, mergeCustomerFields, normalizeEmail, type MergeFields } from "@/lib/crm-duplicates";
import { touchLeadScore } from "@/lib/lead-score-data";

/* Merging duplicate customers into one, and marking a suggested group as
   not duplicates. Owners and admins only, since a merge can't be undone. */

const PAGE = "/dashboard/crm/duplicates";

const ids = (formData: FormData) => [...new Set(formData.getAll("ids").filter((v): v is string => typeof v === "string" && v.length > 0))];

/**
 * Moves everything from the other customers onto the one kept (deals,
 * history, reminders, quotes, contacts, orders, invoices, tickets, projects,
 * EDI partners, documents, tags and sequences), fills the kept customer's
 * blank details from theirs, keeps their other email addresses as contacts,
 * then deletes them. One transaction, so a merge never half happens.
 */
export async function mergeCustomers(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const keepId = formData.get("keepId");
  const groupIds = ids(formData);
  if (typeof keepId !== "string" || !groupIds.includes(keepId) || groupIds.length < 2) redirect(`${PAGE}?error=invalid`);

  const customers = await db.customer.findMany({
    where: { companyId: session.companyId, id: { in: groupIds } },
    include: { tags: { select: { id: true } } },
  });
  if (customers.length !== groupIds.length) redirect(`${PAGE}?error=merge-changed`);

  const keep = customers.find((c) => c.id === keepId)!;
  const others = customers.filter((c) => c.id !== keepId);
  const otherIds = others.map((c) => c.id);
  const asFields = (c: (typeof customers)[number]): MergeFields => ({
    email: c.email,
    phone: c.phone,
    company: c.company,
    notes: c.notes,
    status: c.status,
    source: c.source,
    ownerId: c.ownerId,
    campaignId: c.campaignId,
    creditLimit: c.creditLimit,
    customFields: asCustomValues(c.customFields),
    emailOptOut: c.emailOptOut,
  });
  const merged = mergeCustomerFields(asFields(keep), others.map(asFields));

  // Details that would otherwise be lost become contacts on the kept customer.
  const existingContacts = await db.contact.findMany({ where: { customerId: { in: groupIds } }, select: { email: true } });
  const knownEmails = new Set([normalizeEmail(merged.email), ...existingContacts.map((c) => normalizeEmail(c.email))].filter(Boolean));
  const newContacts = others
    .filter((o) => o.email && !knownEmails.has(normalizeEmail(o.email)))
    .map((o) => ({ name: o.name, email: o.email, phone: o.phone, role: "From a merged record", customerId: keep.id }));

  // A sequence both were in keeps the kept customer's place in it.
  const enrollments = await db.sequenceEnrollment.findMany({ where: { customerId: { in: groupIds } }, select: { id: true, sequenceId: true, customerId: true } });
  const keptSequences = new Set(enrollments.filter((e) => e.customerId === keep.id).map((e) => e.sequenceId));
  const dropEnrollments: string[] = [];
  for (const e of enrollments) {
    if (e.customerId === keep.id) continue;
    if (keptSequences.has(e.sequenceId)) dropEnrollments.push(e.id);
    else keptSequences.add(e.sequenceId);
  }

  const move = { where: { customerId: { in: otherIds } }, data: { customerId: keep.id } };
  await db.$transaction([
    db.sequenceEnrollment.deleteMany({ where: { id: { in: dropEnrollments } } }),
    db.sequenceEnrollment.updateMany(move),
    db.deal.updateMany(move),
    db.crmActivity.updateMany(move),
    db.followUp.updateMany(move),
    db.quote.updateMany(move),
    db.contact.updateMany(move),
    db.order.updateMany(move),
    db.invoice.updateMany(move),
    db.ticket.updateMany(move),
    db.project.updateMany(move),
    db.ediPartner.updateMany(move),
    db.document.updateMany({
      where: { companyId: session.companyId, entityType: "CUSTOMER", entityId: { in: otherIds } },
      data: { entityId: keep.id },
    }),
    db.contact.createMany({ data: newContacts }),
    db.customer.update({
      where: { id: keep.id },
      data: {
        email: merged.email,
        phone: merged.phone,
        company: merged.company,
        notes: merged.notes,
        status: merged.status,
        source: merged.source as typeof keep.source,
        ownerId: merged.ownerId,
        campaignId: merged.campaignId,
        creditLimit: merged.creditLimit,
        customFields: merged.customFields,
        emailOptOut: merged.emailOptOut,
        tags: { connect: [...new Set(others.flatMap((o) => o.tags.map((t) => t.id)))].map((id) => ({ id })) },
      },
    }),
    db.customer.deleteMany({ where: { id: { in: otherIds }, companyId: session.companyId } }),
  ]);

  await logAudit(session.companyId, session.userId, "customer.merged", "Customer", keep.id, {
    kept: keep.name,
    merged: others.map((o) => o.name).join(", "),
  });
  await touchLeadScore(session.companyId, keep.id);
  revalidatePath("/dashboard/crm", "layout");
  redirect(`/dashboard/crm/${keep.id}?merged=${others.length}`);
}

/** Stops suggesting this group. */
export async function dismissDuplicates(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const groupIds = ids(formData);
  if (groupIds.length < 2) redirect(PAGE);
  await db.duplicateDismissal.upsert({
    where: { companyId_key: { companyId: session.companyId, key: groupKey(groupIds) } },
    update: {},
    create: { companyId: session.companyId, key: groupKey(groupIds) },
  });
  revalidatePath(PAGE);
  redirect(`${PAGE}?dismissed=1`);
}
