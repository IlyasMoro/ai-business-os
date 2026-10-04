"use server";

import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { HONEYPOT_FIELD, LeadFormSchema, spamReason } from "@/lib/lead-form";
import { touchLeadScore } from "@/lib/lead-score-data";
import { fireRules } from "@/lib/crm-rules-runner";
import { sendEmailForCompany } from "@/lib/email-for-company";
import { revalidatePath } from "next/cache";

/* A visitor sends the web lead form. A new email becomes a lead (source
   Website) owned by the form's chosen person; a known email adds to that
   customer instead of making a duplicate. Either way the message goes on
   the history and the owner gets a reminder for the next working day.
   Sent from a campaign's form link, a new lead (or a known customer with no
   campaign yet) is attributed to that campaign: first campaign wins. */

export type LeadFormState = { ok?: true; errors?: Record<string, string[]>; message?: string } | undefined;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Tomorrow at 9:00, or Monday when tomorrow is a weekend (server time). */
function nextWorkingMorning(now = new Date()) {
  const due = new Date(now);
  due.setDate(due.getDate() + 1);
  while (due.getDay() === 0 || due.getDay() === 6) due.setDate(due.getDate() + 1);
  due.setHours(9, 0, 0, 0);
  return due;
}

const opt = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v : undefined);

export async function submitLeadForm(
  token: string,
  campaignIdArg: string | null,
  _state: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  const settings = await db.crmSettings.findUnique({ where: { formToken: token }, include: { companyRef: { select: { name: true } } } });
  if (!settings?.formEnabled) return { message: "This form isn't taking messages right now." };

  const spam = spamReason({
    honeypot: typeof formData.get(HONEYPOT_FIELD) === "string" ? (formData.get(HONEYPOT_FIELD) as string) : null,
    startedAt: Number(formData.get("startedAt")),
    now: Date.now(),
  });
  // Bots are told it worked, so they don't learn to get round the check.
  if (spam === "honeypot") return { ok: true };
  if (spam === "too-fast") return { message: "That was quick. Please check your details and send again." };
  if (spam === "stale") return { message: "This page has been open a long time. Please reload it and send again." };

  const parsed = LeadFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: opt(formData.get("phone")),
    company: opt(formData.get("company")),
    message: opt(formData.get("message")),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const ip = await getClientIp();
  const okIp = await checkRateLimit(`lead-form:${ip}`, { max: 5, windowMs: 10 * 60 * 1000 });
  const okCompany = await checkRateLimit(`lead-form-company:${settings.companyId}`, { max: 300, windowMs: 24 * 60 * 60 * 1000 });
  if (!okIp || !okCompany) return { message: "We've had a lot of messages just now. Please try again in a few minutes." };

  const { companyId } = settings;
  const input = parsed.data;
  const email = input.email.toLowerCase();

  // The chosen person, if still in the company; otherwise the first owner.
  const owner =
    (settings.formOwnerId && (await db.user.findFirst({ where: { id: settings.formOwnerId, companyId }, select: { id: true, email: true, name: true } }))) ||
    (await db.user.findFirst({ where: { companyId, role: "OWNER" }, orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true } }));

  // The bound campaign id comes from the page URL, so it is only trusted
  // once it is found in this company.
  const campaign = campaignIdArg
    ? await db.campaign.findFirst({ where: { id: campaignIdArg, companyId }, select: { id: true } })
    : null;

  const existing = await db.customer.findFirst({
    where: { companyId, email: { equals: email, mode: "insensitive" } },
    select: { id: true, ownerId: true, campaignId: true },
  });
  if (existing && campaign && !existing.campaignId) {
    await db.customer.update({ where: { id: existing.id }, data: { campaignId: campaign.id } });
  }
  const customer =
    existing ??
    (await db.customer.create({
      data: {
        companyId,
        name: input.name,
        email,
        phone: input.phone || null,
        company: input.company || null,
        status: "LEAD",
        source: campaign ? "CAMPAIGN" : "WEBSITE",
        campaignId: campaign?.id ?? null,
        ownerId: owner?.id ?? null,
      },
      select: { id: true, ownerId: true, campaignId: true },
    }));
  const assigneeId = customer.ownerId ?? owner?.id ?? null;

  const details = [input.phone && `Phone: ${input.phone}`, input.company && `Company: ${input.company}`].filter(Boolean).join(" · ");
  await db.crmActivity.create({
    data: {
      type: "NOTE",
      body: `Web form ${existing ? "message" : "enquiry"} from ${input.name}${details ? ` (${details})` : ""}:\n${input.message || "No message."}`.slice(0, 4000),
      companyId,
      customerId: customer.id,
    },
  });
  await db.followUp.create({
    data: {
      title: `Reply to the web enquiry from ${input.name}`.slice(0, 200),
      dueAt: nextWorkingMorning(),
      companyId,
      customerId: customer.id,
      assigneeId,
    },
  });
  await touchLeadScore(companyId, customer.id);
  if (!existing) await fireRules({ trigger: "NEW_LEAD", companyId, customerId: customer.id, key: `customer:${customer.id}` });

  const base = process.env.APP_BASE_URL;
  const notify = assigneeId ? await db.user.findUnique({ where: { id: assigneeId }, select: { email: true, name: true } }) : null;
  if (notify) {
    try {
      await sendEmailForCompany(companyId, {
        to: notify.email,
        subject: `New web enquiry from ${input.name}`,
        html: `<p>Hi ${escapeHtml(notify.name)},</p><p>${escapeHtml(input.name)} (${escapeHtml(email)}) sent the web form${
          input.message ? `:</p><blockquote style="border-left:3px solid #cbd5e1;margin:0;padding-left:12px;color:#334155">${escapeHtml(input.message).replace(/\n/g, "<br/>")}</blockquote>` : ".</p>"
        }${base ? `<p><a href="${base}/dashboard/crm/${customer.id}">Open the customer</a></p>` : ""}`,
      });
    } catch (err) {
      console.error(`[lead-form] owner notice failed for company ${companyId}:`, err);
    }
  }

  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/crm/reminders");
  if (campaign) revalidatePath(`/dashboard/marketing/${campaign.id}`);
  return { ok: true };
}
