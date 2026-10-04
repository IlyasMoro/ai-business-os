"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { HONEYPOT_FIELD, spamReason } from "@/lib/lead-form";
import { ContactSchema, topicLabel, type ContactFormState } from "@/lib/contact";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/invoice-rules";
import { requirePlatformAdmin } from "@/lib/platform-admin";

const opt = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v : undefined);

/**
 * A visitor sends the public contact form. The message is saved for the
 * platform admin inbox and emailed to PLATFORM_ADMIN_EMAIL when email is set
 * up; saving never depends on the email. Spam checks match the lead form:
 * a hidden field, a too fast or too old page, and a rate limit per address.
 */
export async function submitContactMessage(_state: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const spam = spamReason({
    honeypot: typeof formData.get(HONEYPOT_FIELD) === "string" ? (formData.get(HONEYPOT_FIELD) as string) : null,
    startedAt: Number(formData.get("startedAt")),
    now: Date.now(),
  });
  // Bots are told it worked, so they don't learn to get round the check.
  if (spam === "honeypot") return { ok: true };
  if (spam === "too-fast") return { message: "That was quick. Please check your details and send again." };
  if (spam === "stale") return { message: "This page has been open a long time. Please reload it and send again." };

  const parsed = ContactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: opt(formData.get("company")),
    topic: formData.get("topic"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const ip = await getClientIp();
  if (!(await checkRateLimit(`contact:${ip}`, { max: 5, windowMs: 10 * 60 * 1000 }))) {
    return { message: "We've had a few messages from you just now. Please try again in a few minutes." };
  }

  const m = parsed.data;
  await db.contactMessage.create({
    data: { name: m.name, email: m.email.toLowerCase(), company: m.company || null, topic: m.topic, message: m.message },
  });

  const admin = process.env.PLATFORM_ADMIN_EMAIL;
  if (admin) {
    try {
      const base = process.env.APP_BASE_URL ?? "";
      await sendEmail({
        to: admin,
        subject: `Contact form: ${topicLabel(m.topic)} from ${m.name}`,
        html: `<p><strong>${escapeHtml(m.name)}</strong> (${escapeHtml(m.email)})${m.company ? `, ${escapeHtml(m.company)}` : ""} wrote about <em>${escapeHtml(
          topicLabel(m.topic)
        )}</em>:</p><blockquote style="border-left:3px solid #cbd5e1;margin:0;padding-left:12px;color:#334155">${escapeHtml(m.message).replace(
          /\n/g,
          "<br/>"
        )}</blockquote>${base ? `<p><a href="${base}/dashboard/admin/messages">Open the inbox</a></p>` : ""}`,
      });
    } catch (err) {
      console.error("[contact] notification email failed:", err);
    }
  }
  return { ok: true };
}

/** Platform admin only: mark a message handled, or back to open. */
export async function setContactMessageHandled(messageId: string, handled: boolean) {
  await requirePlatformAdmin();
  await db.contactMessage.update({ where: { id: messageId }, data: { handledAt: handled ? new Date() : null } });
  revalidatePath("/dashboard/admin/messages");
}
