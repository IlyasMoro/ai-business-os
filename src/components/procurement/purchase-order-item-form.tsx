import { Input, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { addPurchaseOrderItem } from "@/lib/actions/procurement";

export function PurchaseOrderItemForm({
  purchaseOrderId,
  products,
}: {
  purchaseOrderId: string;
  products: { id: string; name: string; sku: string; cost: number }[];
}) {
  const action = addPurchaseOrderItem.bind(null, purchaseOrderId);

  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="col-span-2">
        <Select name="productId" defaultValue="" required>
          <option value="" disabled>
            Select a product
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.sku})
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Input name="quantity" type="number" min="1" step="1" placeholder="Qty" defaultValue={1} required />
      </div>
      <div>
        <Input name="unitCost" type="number" min="0" step="0.01" placeholder="Unit cost" required />
      </div>
      <SubmitButton variant="secondary" pendingText="Adding...">
        Add item
      </SubmitButton>
    </form>
  );
}
