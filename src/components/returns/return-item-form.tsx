import { Input, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { addReturnItem } from "@/lib/actions/returns";

export function ReturnItemForm({
  returnId,
  orderItems,
}: {
  returnId: string;
  orderItems: { id: string; name: string; sku: string; remaining: number }[];
}) {
  const returnable = orderItems.filter((item) => item.remaining > 0);
  if (returnable.length === 0) {
    return <p className="text-sm text-slate-500">Every item on this order has already been returned.</p>;
  }

  const action = addReturnItem.bind(null, returnId);

  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      <div className="col-span-2 sm:col-span-3">
        <Select name="orderItemId" defaultValue="" required>
          <option value="" disabled>
            Select an item
          </option>
          {returnable.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.sku}), up to {item.remaining}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Input name="quantity" type="number" min="1" step="1" placeholder="Qty" defaultValue={1} required />
      </div>
      <div>
        <Select name="condition" defaultValue="RESELLABLE">
          <option value="RESELLABLE">Resellable</option>
          <option value="DAMAGED">Damaged</option>
        </Select>
      </div>
      <SubmitButton variant="secondary" pendingText="Adding...">
        Add item
      </SubmitButton>
    </form>
  );
}
