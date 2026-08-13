"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { runAutomations } from "@/lib/automations";
import { sendWebhookNotification } from "@/lib/webhook";
import { WebhookUrlSchema } from "@/lib/validation/webhook";
import type { ReportFrequency } from "@/generated/prisma/client";

const REPORT_FREQUENCIES = ["OFF", "WEEKLY", "MONTHLY", "QUARTERLY"] as const;

const TOGGLE_KEYS = [
  "overdueInvoiceReminders",
  "lowStockReorder",
  "staleTicketEscalation",
  "staleLeadCleanup",
] as const;

type ToggleKey = (typeof TOGGLE_KEYS)[number];

export async function toggleAutomation(key: ToggleKey, formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  if (!TOGGLE_KEYS.includes(key)) {
    redirect("/dashboard/automation?error=invalid");
  }

  const enabled = formData.get("enabled") === "true";

  await db.automationSettings.upsert({
    where: { companyId: session.companyId },
    create: { companyId: session.companyId, [key]: enabled },
    update: { [key]: enabled },
  });

  revalidatePath("/dashboard/automation");
}

export async function updateReportFrequency(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const frequency = formData.get("reportFrequency");
  if (typeof frequency !== "string" || !REPORT_FREQUENCIES.includes(frequency as ReportFrequency)) {
    redirect("/dashboard/automation?error=invalid");
  }

  await db.automationSettings.upsert({
    where: { companyId: session.companyId },
    create: { companyId: session.companyId, reportFrequency: frequency as ReportFrequency },
    update: { reportFrequency: frequency as ReportFrequency },
  });

  revalidatePath("/dashboard/automation");
}

export async function updateWebhookUrl(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const validated = WebhookUrlSchema.safeParse({ webhookUrl: formData.get("webhookUrl") });
  if (!validated.success) {
    redirect("/dashboard/automation?error=invalid");
  }

  // A blank submission means "leave the existing URL alone" (the form never
  // re-displays the real value), matching the Resend/Groq/OpenAI key cards.
  if (validated.data.webhookUrl) {
    await db.automationSettings.upsert({
      where: { companyId: session.companyId },
      create: { companyId: session.companyId, webhookUrl: validated.data.webhookUrl },
      update: { webhookUrl: validated.data.webhookUrl },
    });
  }

  revalidatePath("/dashboard/automation");
  redirect("/dashboard/automation?saved=1");
}

export async function clearWebhookUrl() {
  const session = await requireRole(["OWNER", "ADMIN"]);

  await db.automationSettings.upsert({
    where: { companyId: session.companyId },
    create: { companyId: session.companyId, webhookUrl: null },
    update: { webhookUrl: null },
  });

  revalidatePath("/dashboard/automation");
}

export async function sendTestWebhook() {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const settings = await db.automationSettings.findUnique({ where: { companyId: session.companyId } });
  if (!settings?.webhookUrl) {
    redirect("/dashboard/automation?error=invalid");
  }

  await sendWebhookNotification(settings.webhookUrl, "Test notification from AIBOS automation webhooks.", {
    event: "test",
  });

  redirect("/dashboard/automation?webhooktested=1");
}

export async function runAutomationsNow() {
  await requireRole(["OWNER", "ADMIN"]);

  await runAutomations();

  revalidatePath("/dashboard/automation");
  redirect("/dashboard/automation?ran=1");
}
