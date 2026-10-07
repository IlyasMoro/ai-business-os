"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { cleanDisabledModules, SWITCHABLE_MODULES } from "@/lib/company-modules";

/** Turns one module on or off for the whole company (Settings > Modules). */
export async function setModuleEnabled(formData: FormData) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const key = String(formData.get("module") ?? "");
  const enabled = formData.get("enabled") === "on";
  const mod = SWITCHABLE_MODULES.find((m) => m.key === key);
  if (!mod) redirect("/dashboard/settings/modules?error=invalid");

  const company = await db.company.findUniqueOrThrow({ where: { id: session.companyId }, select: { disabledModules: true } });
  const current = cleanDisabledModules(company.disabledModules);
  const next = enabled ? current.filter((k) => k !== mod.key) : [...new Set([...current, mod.key])];

  await db.$transaction(async (tx) => {
    await tx.company.update({ where: { id: session.companyId }, data: { disabledModules: next } });
    // Keep the module's own switch in step, where it has one.
    const where = { companyId: session.companyId };
    if (mod.store === "returns") await tx.returnPolicy.updateMany({ where, data: { enabled } });
    if (mod.store === "mrp") await tx.mrpSettings.updateMany({ where, data: { enabled } });
    if (mod.store === "edi") await tx.ediSettings.updateMany({ where, data: { enabled } });
    if (mod.store === "controlling") await tx.controllingSettings.updateMany({ where, data: { enabled } });
  });
  await logAudit(session.companyId, session.userId, enabled ? "module.enabled" : "module.disabled", "Company", session.companyId, { module: mod.key });

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/settings/modules?saved=${mod.key}`);
}
