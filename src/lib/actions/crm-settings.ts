"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";
import { MAX_TAGS, TAG_COLOR_IDS } from "@/lib/crm-tags";
import { MAX_CUSTOM_FIELDS, parseOptions } from "@/lib/custom-fields";
import { syncMailbox } from "@/lib/mail-sync";

/* The CRM settings page: tags, custom fields, who sees which customers,
   the web lead form and email logging. Owners and admins only. */

const PAGE = "/dashboard/crm/settings";

const text = (formData: FormData, name: string, max = 200) => {
  const v = formData.get(name);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
};

function done(anchor: string, flag = "saved"): never {
  revalidatePath(PAGE);
  redirect(`${PAGE}?${flag}=1#${anchor}`);
}

function failed(code: string, anchor: string): never {
  redirect(`${PAGE}?error=${code}#${anchor}`);
}

async function upsertSettings(companyId: string, data: Prisma.CrmSettingsUpdateInput) {
  await db.crmSettings.upsert({
    where: { companyId },
    update: data,
    create: { companyId, ...(data as Prisma.CrmSettingsCreateWithoutCompanyRefInput) },
  });
}

// ---------- Tags ----------

const TagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.enum(TAG_COLOR_IDS),
});

export async function createTag(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const parsed = TagSchema.safeParse({ name: formData.get("name"), color: formData.get("color") || "blue" });
  if (!parsed.success) failed("tag-invalid", "tags");
  if ((await db.customerTag.count({ where: { companyId: session.companyId } })) >= MAX_TAGS) failed("tag-limit", "tags");
  try {
    await db.customerTag.create({ data: { ...parsed.data, companyId: session.companyId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") failed("tag-duplicate", "tags");
    throw e;
  }
  done("tags");
}

export async function updateTag(tagId: string, formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const parsed = TagSchema.safeParse({ name: formData.get("name"), color: formData.get("color") || "blue" });
  if (!parsed.success) failed("tag-invalid", "tags");
  try {
    await db.customerTag.update({ where: { id: tagId, companyId: session.companyId }, data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") failed("tag-duplicate", "tags");
    throw e;
  }
  revalidatePath("/dashboard/crm");
  done("tags");
}

export async function deleteTag(tagId: string) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  await db.customerTag.deleteMany({ where: { id: tagId, companyId: session.companyId } });
  revalidatePath("/dashboard/crm");
  done("tags");
}

// ---------- Custom fields ----------

const FieldSchema = z.object({
  label: z.string().trim().min(1).max(60),
  type: z.enum(["TEXT", "NUMBER", "DATE", "SELECT"]),
});

export async function createCustomField(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const parsed = FieldSchema.safeParse({ label: formData.get("label"), type: formData.get("type") });
  if (!parsed.success) failed("field-invalid", "fields");
  const options = parsed.data.type === "SELECT" ? parseOptions(String(formData.get("options") ?? "")) : [];
  if (parsed.data.type === "SELECT" && options.length < 2) failed("field-options", "fields");

  const existing = await db.customField.findMany({ where: { companyId: session.companyId }, select: { position: true } });
  if (existing.length >= MAX_CUSTOM_FIELDS) failed("field-limit", "fields");
  const field = await db.customField.create({
    data: {
      ...parsed.data,
      options,
      position: existing.reduce((max, f) => Math.max(max, f.position), -1) + 1,
      companyId: session.companyId,
    },
  });
  await logAudit(session.companyId, session.userId, "crm.field_created", "CustomField", field.id, { label: parsed.data.label });
  done("fields");
}

/** Renames a field or changes its dropdown choices. The type stays, so
 * values already saved keep their meaning. */
export async function updateCustomField(fieldId: string, formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const field = await db.customField.findFirst({ where: { id: fieldId, companyId: session.companyId } });
  if (!field) done("fields");
  const label = text(formData, "label", 60);
  if (!label) failed("field-invalid", "fields");
  const options = field.type === "SELECT" ? parseOptions(String(formData.get("options") ?? "")) : [];
  if (field.type === "SELECT" && options.length < 2) failed("field-options", "fields");
  await db.customField.update({ where: { id: field.id }, data: { label, options } });
  done("fields");
}

export async function moveCustomField(fieldId: string, direction: "up" | "down") {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const fields = await db.customField.findMany({ where: { companyId: session.companyId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = fields.findIndex((f) => f.id === fieldId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= fields.length) done("fields");
  [fields[i], fields[j]] = [fields[j], fields[i]];
  await db.$transaction(fields.map((f, position) => db.customField.update({ where: { id: f.id }, data: { position } })));
  done("fields");
}

/** Removes the field and the values saved for it on every customer. */
export async function deleteCustomField(fieldId: string) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const field = await db.customField.findFirst({ where: { id: fieldId, companyId: session.companyId } });
  if (!field) done("fields");
  await db.$transaction([
    db.customField.delete({ where: { id: field.id } }),
    db.$executeRaw`UPDATE "Customer" SET "customFields" = "customFields" - ${field.id} WHERE "companyId" = ${session.companyId} AND "customFields" ? ${field.id}`,
  ]);
  await logAudit(session.companyId, session.userId, "crm.field_deleted", "CustomField", field.id, { label: field.label });
  revalidatePath("/dashboard/crm");
  done("fields");
}

// ---------- Visibility ----------

export async function saveVisibility(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const ownCustomersOnly = formData.get("ownCustomersOnly") === "on";
  await upsertSettings(session.companyId, { ownCustomersOnly });
  await logAudit(session.companyId, session.userId, "crm.visibility_changed", "CrmSettings", session.companyId, { ownCustomersOnly });
  revalidatePath("/dashboard/crm", "layout");
  revalidatePath("/dashboard/quotes", "layout");
  done("visibility");
}

// ---------- Web lead form ----------

const newFormToken = () => randomBytes(18).toString("base64url");

export async function saveLeadForm(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const ownerId = text(formData, "formOwnerId", 40);
  if (ownerId && !(await db.user.findFirst({ where: { id: ownerId, companyId: session.companyId }, select: { id: true } }))) {
    failed("invalid", "lead-form");
  }
  const current = await db.crmSettings.findUnique({ where: { companyId: session.companyId }, select: { formToken: true } });
  await upsertSettings(session.companyId, {
    formEnabled: formData.get("formEnabled") === "on",
    formTitle: text(formData, "formTitle", 80),
    formIntro: text(formData, "formIntro", 400),
    formThanks: text(formData, "formThanks", 400),
    formOwnerId: ownerId,
    formToken: current?.formToken ?? newFormToken(),
  });
  done("lead-form");
}

/** A new link for the form; the old link (and any embed using it) stops working. */
export async function resetLeadFormLink() {
  const session = await requireRole(["OWNER", "ADMIN"]);
  await upsertSettings(session.companyId, { formToken: newFormToken() });
  await logAudit(session.companyId, session.userId, "crm.form_link_reset", "CrmSettings", session.companyId, {});
  done("lead-form", "reset");
}

// ---------- Email logging ----------

export async function saveEmailLogging(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const emailLogging = formData.get("emailLogging") === "on";
  await upsertSettings(session.companyId, { emailLogging });
  await logAudit(session.companyId, session.userId, "crm.email_logging_changed", "CrmSettings", session.companyId, { emailLogging });
  done("email-logging");
}

export async function syncMailNow() {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const result = await syncMailbox(session.companyId);
  revalidatePath(PAGE);
  if (!result.ok) failed(`mail-${result.reason}`, "email-logging");
  redirect(`${PAGE}?synced=${result.logged}#email-logging`);
}
