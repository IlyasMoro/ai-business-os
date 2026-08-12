"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { CompanyProfileSchema } from "@/lib/validation/company";

export async function updateCompanyProfile(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const validated = CompanyProfileSchema.safeParse({
    name: formData.get("name"),
    industry: formData.get("industry"),
  });

  if (!validated.success) {
    redirect("/dashboard/settings?error=invalid");
  }

  const { name, industry } = validated.data;

  await db.company.update({
    where: { id: session.companyId },
    data: { name, industry: industry || null },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings?saved=1");
}
