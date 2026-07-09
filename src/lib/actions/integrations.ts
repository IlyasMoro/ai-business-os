"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { sendEmailForCompany } from "@/lib/email-for-company";

export async function disconnectGoogle() {
  const session = await requireRole(["OWNER", "ADMIN"]);

  await db.googleIntegration.deleteMany({ where: { companyId: session.companyId } });

  revalidatePath("/dashboard/integrations");
}

export async function sendTestEmail() {
  await requireRole(["OWNER", "ADMIN"]);
  const user = await getCurrentUser();

  let succeeded = true;
  try {
    await sendEmailForCompany(user.companyId, {
      to: user.email,
      subject: "Test email from AI Business OS",
      html: `<p>Hi ${user.name},</p><p>This is a test email confirming your connected email account is working.</p>`,
    });
  } catch (err) {
    console.error("[integrations] test email failed:", err);
    succeeded = false;
  }

  redirect(succeeded ? "/dashboard/integrations?testsent=1" : "/dashboard/integrations?error=invalid");
}
