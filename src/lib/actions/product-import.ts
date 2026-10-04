"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { setStockAt, changeStock } from "@/lib/stock";
import { MAX_IMPORT_BYTES, parseCsv } from "@/lib/customer-import";
import { planProductImport, type ProductImportPlan } from "@/lib/product-import";

/* Product CSV import in two steps (check, then import), and the branch
   stock count. Owners and admins only: both change a lot of stock at once. */

export type ProductImportPreviewState =
  | { error?: string; csv?: string; fileName?: string; plan?: Omit<ProductImportPlan, "ready"> & { readyCount: number; sample: ProductImportPlan["ready"] } }
  | undefined;

async function planFor(companyId: string, csv: string) {
  const products = await db.product.findMany({ where: { companyId }, select: { sku: true } });
  return planProductImport(parseCsv(csv), { existingSkus: new Set(products.map((p) => p.sku.toLowerCase())) });
}

export async function previewProductImport(_state: ProductImportPreviewState, formData: FormData): Promise<ProductImportPreviewState> {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) return { error: "Only owners and admins can import products." };
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

export async function importProducts(formData: FormData) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/inventory?error=forbidden");
  const csv = formData.get("csv");
  if (typeof csv !== "string" || csv.length > MAX_IMPORT_BYTES * 2) redirect("/dashboard/inventory/import?error=invalid");
  const branchId = String(formData.get("branchId") ?? "");
  const branch = await db.branch.findFirst({ where: { id: branchId, companyId: session.companyId, active: true }, select: { id: true } });
  if (!branch) redirect("/dashboard/inventory/import?error=invalid");

  // Checked again: products may have been added since the preview.
  const plan = await planFor(session.companyId, csv);
  if (plan.fatal || plan.ready.length === 0) redirect("/dashboard/inventory/import?error=invalid");

  await db.$transaction(
    async (tx) => {
      for (const p of plan.ready) {
        const created = await tx.product.create({
          data: {
            sku: p.sku,
            name: p.name,
            description: p.description,
            cost: p.cost,
            unitPrice: p.unitPrice,
            reorderLevel: p.reorderLevel,
            stockQty: 0,
            companyId: session.companyId,
          },
          select: { id: true },
        });
        await setStockAt(tx, {
          companyId: session.companyId,
          branchId: branch.id,
          productId: created.id,
          quantity: p.stockQty,
          movement: { kind: "OPENING", userId: session.userId, note: "Opening stock from a product import" },
        });
      }
    },
    { timeout: 60_000 }
  );
  await logAudit(session.companyId, session.userId, "products.imported", "Product", "", {
    imported: plan.ready.length,
    skipped: plan.duplicates.length + plan.problems.length,
  });
  revalidatePath("/dashboard/inventory");
  redirect(`/dashboard/inventory?imported=${plan.ready.length}`);
}

/**
 * A stock count for one branch: every product with a counted quantity that
 * differs from the system is adjusted to it, recorded as "Stock count
 * correction". Blank fields weren't counted and stay as they are. Lot and
 * serial products are counted through their lots instead.
 */
export async function submitStockCount(formData: FormData) {
  const session = await verifySession();
  const back = "/dashboard/inventory/count";
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/inventory?error=forbidden");
  const branchId = String(formData.get("branchId") ?? "");
  const branch = await db.branch.findFirst({ where: { id: branchId, companyId: session.companyId, active: true }, select: { id: true, name: true } });
  if (!branch) redirect(`${back}?error=invalid`);

  const counted = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("count_") || typeof value !== "string" || value.trim() === "") continue;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) redirect(`${back}?branch=${branch.id}&error=invalid`);
    counted.set(key.slice("count_".length), n);
  }
  if (counted.size === 0) redirect(`${back}?branch=${branch.id}&why=${encodeURIComponent("Enter at least one counted quantity.")}`);

  const products = await db.product.findMany({
    where: { companyId: session.companyId, id: { in: [...counted.keys()] }, trackingMode: "NONE" },
    select: { id: true },
  });
  const note = `Stock count at ${branch.name}`;
  let changed = 0;
  await db.$transaction(
    async (tx) => {
      for (const { id } of products) {
        const row = await tx.branchStock.findUnique({ where: { branchId_productId: { branchId: branch.id, productId: id } }, select: { quantity: true } });
        const delta = counted.get(id)! - (row?.quantity ?? 0);
        if (delta === 0) continue;
        changed++;
        await changeStock(tx, {
          companyId: session.companyId,
          branchId: branch.id,
          productId: id,
          delta,
          movement: { kind: "ADJUSTMENT", userId: session.userId, reason: "COUNT", note },
        });
      }
    },
    { timeout: 60_000 }
  );
  await logAudit(session.companyId, session.userId, "stock.counted", "Branch", branch.id, { branch: branch.name, counted: products.length, changed });
  revalidatePath("/dashboard/inventory");
  redirect(`${back}?branch=${branch.id}&counted=${products.length}&changed=${changed}`);
}
