"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ProductSchema, type ProductFormState } from "@/lib/validation/inventory";
import { resolveNewRecordBranch } from "@/lib/branches";
import { setStockAt } from "@/lib/stock";

export async function createProduct(
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const session = await verifySession();

  const validated = ProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description"),
    cost: formData.get("cost"),
    unitPrice: formData.get("unitPrice"),
    stockQty: formData.get("stockQty"),
    reorderLevel: formData.get("reorderLevel"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { description, stockQty, ...rest } = validated.data;

  const existing = await db.product.findUnique({
    where: { companyId_sku: { companyId: session.companyId, sku: rest.sku } },
    select: { id: true },
  });
  if (existing) {
    return { errors: { sku: ["A product with this SKU already exists."] } };
  }

  // Opening stock sits at the chosen branch; the total follows from it.
  const branchId = await resolveNewRecordBranch(formData);
  if (!branchId) return { message: "Choose a branch for this product's stock." };
  const product = await db.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: { ...rest, stockQty: 0, description: description || undefined, companyId: session.companyId },
    });
    await setStockAt(tx, { companyId: session.companyId, branchId, productId: created.id, quantity: stockQty });
    return created;
  });

  revalidatePath("/dashboard/inventory");
  redirect(`/dashboard/inventory/${product.id}`);
}

export async function updateProduct(
  productId: string,
  _state: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const session = await verifySession();

  const validated = ProductSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: formData.get("description"),
    cost: formData.get("cost"),
    unitPrice: formData.get("unitPrice"),
    stockQty: formData.get("stockQty"),
    reorderLevel: formData.get("reorderLevel"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { description, stockQty, ...rest } = validated.data;

  const existing = await db.product.findFirst({
    where: { companyId: session.companyId, sku: rest.sku, id: { not: productId } },
    select: { id: true },
  });
  if (existing) {
    return { errors: { sku: ["A product with this SKU already exists."] } };
  }

  // The stock field is the count at one branch (sent by the form, checked
  // against the user's access), not the company total.
  const branchId = await resolveNewRecordBranch(formData);
  if (!branchId) return { message: "Choose a branch for this product's stock." };
  const current = await db.product.findUnique({
    where: { id: productId, companyId: session.companyId },
    select: { trackingMode: true, branchStock: { where: { branchId }, select: { quantity: true } } },
  });
  if (!current) return { message: "Product not found." };
  const currentAtBranch = current.branchStock[0]?.quantity ?? 0;
  if (current.trackingMode !== "NONE" && currentAtBranch !== stockQty) {
    return {
      errors: {
        stockQty: ["This product is lot or serial tracked, so its stock only changes by receiving, shipping or building."],
      },
    };
  }

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId, companyId: session.companyId },
      data: { ...rest, description: description || null },
    });
    await setStockAt(tx, { companyId: session.companyId, branchId, productId, quantity: stockQty });
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/inventory/${productId}`);
  redirect(`/dashboard/inventory/${productId}`);
}

export async function applyReorderSuggestion(productId: string, suggestedLevel: number) {
  const session = await verifySession();

  await db.product.update({
    where: { id: productId, companyId: session.companyId },
    data: { reorderLevel: Math.round(suggestedLevel) },
  });

  revalidatePath(`/dashboard/inventory/${productId}`);
}

export async function deleteProduct(productId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/inventory?error=forbidden");
  }

  const [inOrder, inBom, inWorkOrder] = await Promise.all([
    db.orderItem.findFirst({ where: { productId, product: { companyId: session.companyId } }, select: { id: true } }),
    // Components are protected; a product's own BOM lines go with it.
    db.bomLine.findFirst({ where: { componentId: productId, companyId: session.companyId }, select: { id: true } }),
    db.workOrder.findFirst({ where: { productId, companyId: session.companyId }, select: { id: true } }),
  ]);
  if (inOrder || inBom || inWorkOrder) {
    redirect(`/dashboard/inventory/${productId}?error=in-use`);
  }

  await db.product.delete({
    where: { id: productId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

/**
 * A branch's own reorder level for a product; blank goes back to the
 * product's level. Owners and admins only, like other stock policy.
 */
export async function setBranchReorderLevel(productId: string, branchId: string, formData: FormData) {
  const session = await verifySession();
  const back = `/dashboard/inventory/${productId}`;
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect(`${back}?error=forbidden`);

  const raw = String(formData.get("reorderLevel") ?? "").trim();
  const level = raw === "" ? null : Number(raw);
  if (level !== null && (!Number.isInteger(level) || level < 0 || level > 1_000_000)) redirect(`${back}?error=invalid`);

  const [product, branch] = await Promise.all([
    db.product.findUnique({ where: { id: productId, companyId: session.companyId }, select: { id: true } }),
    db.branch.findUnique({ where: { id: branchId, companyId: session.companyId }, select: { id: true } }),
  ]);
  if (!product || !branch) redirect(`${back}?error=invalid`);

  await db.branchStock.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { companyId: session.companyId, branchId, productId, quantity: 0, reorderLevel: level },
    update: { reorderLevel: level },
  });

  revalidatePath(back);
  revalidatePath("/dashboard/inventory");
  redirect(`${back}?saved=1`);
}
