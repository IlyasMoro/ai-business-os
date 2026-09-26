import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { getBranchContext, resolveNewRecordBranch } from "@/lib/branches";
import { ProductForm } from "@/components/inventory/product-form";
import { updateProduct } from "@/lib/actions/inventory";
import type { ProductFormState } from "@/lib/validation/inventory";
import { BackButton } from "@/components/ui-dark/back-button";

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

  // The stock field is a count at one branch: the one in view (or the
  // user's own), else the main branch.
  const [ctx, branchId] = await Promise.all([getBranchContext(), resolveNewRecordBranch()]);
  const branch = ctx.branches.find((b) => b.id === branchId);
  const atBranch = branchId
    ? await db.branchStock.findUnique({
        where: { branchId_productId: { branchId, productId: product.id } },
        select: { quantity: true },
      })
    : null;
  const multiBranch = ctx.branches.filter((b) => b.active).length > 1;

  const action = updateProduct.bind(null, product.id) as (
    state: ProductFormState,
    formData: FormData
  ) => Promise<ProductFormState>;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href={`/dashboard/inventory/${id}`} label="Back to product" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Edit product</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ProductForm
            action={action}
            defaultValues={{ ...product, stockQty: atBranch?.quantity ?? 0 }}
            stockBranch={branch ? { id: branch.id, label: multiBranch ? `Stock at ${branch.name}` : "Stock quantity" } : null}
            submitLabel="Save changes"
          />
        </div>
      </div>
    </div>
  );
}
