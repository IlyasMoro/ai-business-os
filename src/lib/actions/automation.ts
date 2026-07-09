"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { runAutomations } from "@/lib/automations";

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

export async function runAutomationsNow() {
  await requireRole(["OWNER", "ADMIN"]);

  await runAutomations();

  revalidatePath("/dashboard/automation");
  redirect("/dashboard/automation?ran=1");
}
