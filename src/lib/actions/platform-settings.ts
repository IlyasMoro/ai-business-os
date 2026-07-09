"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { PlatformEmailSettingsSchema } from "@/lib/validation/platform-settings";

async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  if (!isPlatformAdmin(user.email)) {
    redirect("/dashboard?error=forbidden");
  }
  return user;
}

export async function updateEmailSettings(formData: FormData) {
  await requirePlatformAdmin();

  const validated = PlatformEmailSettingsSchema.safeParse({
    resendApiKey: formData.get("resendApiKey"),
    resendFromEmail: formData.get("resendFromEmail"),
  });

  if (!validated.success) {
    redirect("/dashboard/platform-settings?error=invalid");
  }

  const { resendApiKey, resendFromEmail } = validated.data;

  const existing = await db.platformSettings.findUnique({ where: { id: "platform" } });

  await db.platformSettings.upsert({
    where: { id: "platform" },
    create: {
      id: "platform",
      // An empty submitted key means "leave the existing one alone" — the
      // form never re-displays the real key, so a blank field isn't the user
      // asking to clear it.
      resendApiKey: resendApiKey || undefined,
      resendFromEmail: resendFromEmail || undefined,
    },
    update: {
      resendApiKey: resendApiKey || existing?.resendApiKey,
      resendFromEmail: resendFromEmail || existing?.resendFromEmail,
    },
  });

  revalidatePath("/dashboard/platform-settings");
  redirect("/dashboard/platform-settings?saved=1");
}

export async function clearEmailSettings() {
  await requirePlatformAdmin();

  await db.platformSettings.upsert({
    where: { id: "platform" },
    create: { id: "platform", resendApiKey: null, resendFromEmail: null },
    update: { resendApiKey: null, resendFromEmail: null },
  });

  revalidatePath("/dashboard/platform-settings");
}

export async function sendTestPlatformEmail(toEmail: string) {
  await requirePlatformAdmin();

  try {
    await sendEmail({
      to: toEmail,
      subject: "Test email from AI Business OS platform settings",
      html: "<p>This confirms your platform-wide email sending configuration works.</p>",
    });
    redirect("/dashboard/platform-settings?testsent=1");
  } catch (err) {
    console.error("[platform-settings] test email failed:", err);
    redirect("/dashboard/platform-settings?error=invalid");
  }
}
