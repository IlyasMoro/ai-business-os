import { ProductForm } from "@/components/inventory/product-form";
import { createProduct } from "@/lib/actions/inventory";

export default function NewProductPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New product</h1>
      <div className="mt-6">
        <ProductForm action={createProduct} submitLabel="Create product" />
      </div>
    </div>
  );
}
