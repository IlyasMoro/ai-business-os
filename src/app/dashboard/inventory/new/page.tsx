import { ProductForm } from "@/components/inventory/product-form";
import { createProduct } from "@/lib/actions/inventory";
import { branchPicker } from "@/lib/branches";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function NewProductPage() {
  const branches = await branchPicker();
  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/inventory" label="Back to inventory" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New product</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <ProductForm action={createProduct} branches={branches} submitLabel="Create product" />
        </div>
      </div>
    </div>
  );
}
