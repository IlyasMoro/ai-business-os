"use server";

import { formatCurrency } from "@/lib/utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { acceptQuoteRecord, declineQuoteRecord } from "@/lib/quote-accept";
import { sendEmailForCompany } from "@/lib/email-for-company";

/* The customer's answer on /q/<token>. No sign in: the secret link is the
   permission, and each IP gets a handful of tries an hour. */

export type QuoteAnswerState = { error?: string } | undefined;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function findByToken(token: string) {
  return db.quote.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      quoteNumber: true,
      companyId: true,
      customerId: true,
      dealId: true,
      totalAmount: true,
      customer: { select: { name: true } },
      owner: { select: { id: true, email: true, name: true } },
    },
  });
}

/** Lets the salesperson know straight away; never blocks the customer. */
async function tellOwner(quote: NonNullable<Awaited<ReturnType<typeof findByToken>>>, what: string) {
  if (!quote.owner?.email) return;
  const base = process.env.APP_BASE_URL;
  try {
    await sendEmailForCompany(quote.companyId, {
      to: quote.owner.email,
      subject: `Quote ${quote.quoteNumber} ${what} by ${quote.customer.name}`,
      html: `<p>Hi ${escapeHtml(quote.owner.name)},</p><p>${escapeHtml(quote.customer.name)} ${what} quote ${quote.quoteNumber} (${formatCurrency(quote.totalAmount)}) online.</p>${
        base ? `<p><a href="${base}/dashboard/quotes/${quote.id}">Open the quote</a></p>` : ""
      }`,
    });
  } catch (err) {
    console.error(`[quotes] owner notice failed for quote ${quote.id}:`, err);
  }
}

async function tooMany(): Promise<boolean> {
  const ip = await getClientIp();
  return !(await checkRateLimit(`quote-answer:${ip}`, { max: 10, windowMs: 60 * 60 * 1000 }));
}

function refresh(quote: { id: string; customerId: string; dealId: string | null }) {
  revalidatePath("/dashboard/quotes");
  revalidatePath(`/dashboard/quotes/${quote.id}`);
  revalidatePath(`/dashboard/crm/${quote.customerId}`);
  revalidatePath("/dashboard/crm/deals");
  if (quote.dealId) revalidatePath(`/dashboard/crm/deals/${quote.dealId}`);
}

export async function acceptQuoteOnline(token: string, _state: QuoteAnswerState, formData: FormData): Promise<QuoteAnswerState> {
  const name = String(formData.get("signedName") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 120) return { error: "Type your full name to accept." };
  if (formData.get("agree") !== "on") return { error: "Tick the box to confirm you accept the quote." };
  if (await tooMany()) return { error: "Too many attempts. Please wait a while and try again." };

  const quote = await findByToken(token);
  if (!quote) return { error: "This link is no longer valid." };

  const result = await acceptQuoteRecord(quote.id, quote.companyId, { userId: null, signedName: name, signedIp: await getClientIp() });
  if (!result.ok) {
    return { error: result.reason === "blocked" ? "This quote can no longer be accepted. Please contact us for a new one." : "This quote has already been answered." };
  }
  if (quote.owner) {
    await logAudit(quote.companyId, quote.owner.id, "quote.accepted", "Quote", quote.id, { by: "customer online", name });
  }
  await tellOwner(quote, "was accepted");
  refresh(quote);
  redirect(`/q/${token}?done=accepted`);
}

export async function declineQuoteOnline(token: string, _state: QuoteAnswerState, formData: FormData): Promise<QuoteAnswerState> {
  if (await tooMany()) return { error: "Too many attempts. Please wait a while and try again." };
  const quote = await findByToken(token);
  if (!quote) return { error: "This link is no longer valid." };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 1000);
  if (!(await declineQuoteRecord(quote.id, quote.companyId, { userId: null, reason, online: true }))) {
    return { error: "This quote has already been answered." };
  }
  if (quote.owner) {
    await logAudit(quote.companyId, quote.owner.id, "quote.declined", "Quote", quote.id, { by: "customer online" });
  }
  await tellOwner(quote, "was declined");
  refresh(quote);
  redirect(`/q/${token}?done=declined`);
}
