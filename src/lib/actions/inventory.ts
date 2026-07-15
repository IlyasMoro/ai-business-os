"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ProductSchema, type ProductFormState } from "@/lib/validation/inventory";

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

  const { description, ...rest } = validated.data;

  const existing = await db.product.findUnique({
    where: { companyId_sku: { companyId: session.companyId, sku: rest.sku } },
    select: { id: true },
  });
  if (existing) {
    return { errors: { sku: ["A product with this SKU already exists."] } };
  }

  const product = await db.product.create({
    data: { ...rest, description: description || undefined, companyId: session.companyId },
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

  const { description, ...rest } = validated.data;

  const existing = await db.product.findFirst({
    where: { companyId: session.companyId, sku: rest.sku, id: { not: productId } },
    select: { id: true },
  });
  if (existing) {
    return { errors: { sku: ["A product with this SKU already exists."] } };
  }

  await db.product.update({
    where: { id: productId, companyId: session.companyId },
    data: { ...rest, description: description || null },
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

  const inUse = await db.orderItem.findFirst({
    where: { productId, product: { companyId: session.companyId } },
    select: { id: true },
  });
  if (inUse) {
    redirect(`/dashboard/inventory/${productId}?error=in-use`);
  }

  await db.product.delete({
    where: { id: productId, companyId: session.companyId },
  });

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}
