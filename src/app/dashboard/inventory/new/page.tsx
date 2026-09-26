import { ProductForm } from "@/components/inventory/product-form";
import { createProduct } from "@/lib/actions/inventory";
import { branchPicker } from "@/lib/branches";

export default async function NewProductPage() {
  const branches = await branchPicker();
  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New product</h1>
      <div className="mt-6">
        <ProductForm action={createProduct} branches={branches} submitLabel="Create product" />
      </div>
    </div>
  );
}
