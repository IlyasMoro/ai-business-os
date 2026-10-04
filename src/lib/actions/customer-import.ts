"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { MAX_IMPORT_BYTES, parseCsv, planImport, type ImportPlan } from "@/lib/customer-import";

/* Customer CSV import in two steps: check the file and show what will
   happen, then import on confirmation. The file is checked again on
   confirmation, since customers may have been added in between. Owners and
   admins only, as it adds many records at once. */

export type ImportPreviewState =
  | {
      error?: string;
      csv?: string;
      fileName?: string;
      plan?: Omit<ImportPlan, "ready"> & { readyCount: number; sample: ImportPlan["ready"] };
    }
  | undefined;

async function planFor(companyId: string, csv: string) {
  const [customers, team] = await Promise.all([
    db.customer.findMany({ where: { companyId, email: { not: null } }, select: { email: true } }),
    db.user.findMany({ where: { companyId }, select: { id: true, email: true } }),
  ]);
  return planImport(parseCsv(csv), {
    existingEmails: new Set(customers.map((c) => c.email!.trim().toLowerCase())),
    teamByEmail: new Map(team.map((u) => [u.email.toLowerCase(), u.id])),
  });
}

export async function previewCustomerImport(_state: ImportPreviewState, formData: FormData): Promise<ImportPreviewState> {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) return { error: "Only owners and admins can import customers." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };
  if (file.size > MAX_IMPORT_BYTES) return { error: "The file is larger than 1MB. Split it into smaller files." };
  if (!/\.(csv|txt)$/i.test(file.name)) return { error: "The file must be a .csv file. In Excel, use Save As and choose CSV." };

  const csv = await file.text();
  const plan = await planFor(session.companyId, csv);
  if (plan.fatal) return { error: plan.fatal };
  const { ready, ...rest } = plan;
  return { csv, fileName: file.name, plan: { ...rest, readyCount: ready.length, sample: ready.slice(0, 8) } };
}

export async function importCustomers(formData: FormData) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/crm?error=forbidden");
  const csv = formData.get("csv");
  if (typeof csv !== "string" || csv.length > MAX_IMPORT_BYTES * 2) redirect("/dashboard/crm/import?error=invalid");

  const plan = await planFor(session.companyId, csv);
  if (plan.fatal || plan.ready.length === 0) redirect("/dashboard/crm/import?error=invalid");

  const result = await db.customer.createMany({
    data: plan.ready.map((c) => ({
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      status: c.status,
      source: c.source,
      notes: c.notes,
      creditLimit: c.creditLimit,
      ownerId: c.ownerId ?? session.userId,
      companyId: session.companyId,
    })),
  });
  await logAudit(session.companyId, session.userId, "customers.imported", "Customer", "", {
    imported: result.count,
    skipped: plan.duplicates.length + plan.problems.length,
  });
  revalidatePath("/dashboard/crm");
  redirect(`/dashboard/crm?imported=${result.count}`);
}
