"use server";

import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { db } from "@/lib/db";

export async function deleteCompany(companyId: string, formData: FormData) {
  await requirePlatformAdmin();

  const company = await db.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) {
    redirect("/dashboard/admin");
  }

  const confirmation = formData.get("confirmCompanyName");
  if (confirmation !== company.name) {
    redirect(`/dashboard/admin/${companyId}?error=confirm`);
  }

  await db.company.delete({ where: { id: companyId } });

  redirect("/dashboard/admin?deleted=1");
}
