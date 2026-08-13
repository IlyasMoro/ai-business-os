"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { CompanyProfileSchema } from "@/lib/validation/company";

const LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg"];

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

export async function updateCompanyLogo(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/dashboard/settings?error=invalid");
  }
  if (file.size > LOGO_MAX_SIZE_BYTES || !LOGO_ALLOWED_TYPES.includes(file.type)) {
    redirect("/dashboard/settings?error=invalid");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  await db.company.update({
    where: { id: session.companyId },
    data: { logoData: buffer, logoMimeType: file.type },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings?saved=1");
}

export async function removeCompanyLogo() {
  const session = await requireRole(["OWNER", "ADMIN"]);

  await db.company.update({
    where: { id: session.companyId },
    data: { logoData: null, logoMimeType: null },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");
}
