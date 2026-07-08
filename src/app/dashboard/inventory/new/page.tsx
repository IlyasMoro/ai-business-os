import { ProductForm } from "@/components/inventory/product-form";
import { createProduct } from "@/lib/actions/inventory";

export default function NewProductPage() {
  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-slate-950 p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-white">New product</h1>
      <div className="mt-6">
        <ProductForm action={createProduct} submitLabel="Create product" />
      </div>
    </div>
  );
}
