import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { ProductForm } from "@/components/inventory/product-form";
import { updateProduct } from "@/lib/actions/inventory";
import type { ProductFormState } from "@/lib/validation/inventory";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  const product = await db.product.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!product) notFound();

  const action = updateProduct.bind(null, product.id) as (
    state: ProductFormState,
    formData: FormData
  ) => Promise<ProductFormState>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Edit product</h1>
      <div className="mt-6">
        <ProductForm action={action} defaultValues={product} submitLabel="Save changes" />
      </div>
    </div>
  );
}
