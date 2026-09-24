import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { updatePlanningFields } from "@/lib/actions/mrp";

export function PlanningFieldsForm({
  productId,
  leadTimeDays,
  lotSize,
  preferredSupplierId,
  suppliers,
}: {
  productId: string;
  leadTimeDays: number;
  lotSize: number;
  preferredSupplierId: string | null;
  suppliers: { id: string; name: string }[];
}) {
  const action = updatePlanningFields.bind(null, productId);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="leadTimeDays">Lead time (days)</Label>
        <Input id="leadTimeDays" name="leadTimeDays" type="number" min="0" max="3650" step="1" defaultValue={leadTimeDays} required />
        <p className="mt-1 text-xs text-slate-500">How long one batch takes to arrive or be built.</p>
      </div>
      <div>
        <Label htmlFor="lotSize">Lot size</Label>
        <Input id="lotSize" name="lotSize" type="number" min="1" step="1" defaultValue={lotSize} required />
        <p className="mt-1 text-xs text-slate-500">Planned quantities round up to multiples of this.</p>
      </div>
      <div>
        <Label htmlFor="preferredSupplierId">Preferred supplier</Label>
        <Select id="preferredSupplierId" name="preferredSupplierId" defaultValue={preferredSupplierId ?? ""}>
          <option value="">None</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-slate-500">Used when planning turns a shortage into a purchase order.</p>
      </div>
      <div className="sm:col-span-3">
        <SubmitButton variant="secondary" pendingText="Saving...">
          Save planning
        </SubmitButton>
      </div>
    </form>
  );
}
