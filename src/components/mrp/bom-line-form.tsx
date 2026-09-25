import { Input, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { addBomLine } from "@/lib/actions/mrp";

export function BomLineForm({
  productId,
  components,
}: {
  productId: string;
  components: { id: string; name: string; sku: string }[];
}) {
  if (components.length === 0) {
    return <p className="text-sm text-slate-500">Add other products to inventory first; they can then be used as components.</p>;
  }

  const action = addBomLine.bind(null, productId);

  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="col-span-2 sm:col-span-3">
        <Select name="componentId" defaultValue="" required>
          <option value="" disabled>
            Select a component
          </option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.sku})
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Input name="quantity" type="number" min="0.001" step="any" placeholder="Qty per unit" defaultValue={1} required />
      </div>
      <SubmitButton variant="secondary" pendingText="Adding...">
        Add component
      </SubmitButton>
    </form>
  );
}
