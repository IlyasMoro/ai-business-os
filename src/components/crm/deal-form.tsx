import { Input, Label, Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { DEAL_STAGES } from "@/lib/crm-pipeline";

type DealValues = {
  title: string;
  value: number;
  stage: string;
  probability: number;
  expectedClose: Date | null;
  ownerId: string | null;
  lostReason: string | null;
};

/** yyyy-mm-dd for a date input, from a stored date. */
function dateInput(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

/**
 * Deal fields for creating (pick the customer) or editing (customer fixed,
 * plus chance of winning and why it was lost).
 */
export function DealForm({
  action,
  deal,
  customers,
  customerId,
  users,
  currentUserId,
  back,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  /** Existing deal when editing. */
  deal?: DealValues;
  /** Customers to choose from when creating. */
  customers?: { id: string; name: string }[];
  /** Preselected customer when creating from a customer page. */
  customerId?: string;
  users: { id: string; name: string }[];
  currentUserId: string;
  back?: string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      {back && <input type="hidden" name="back" value={back} />}
      <div>
        <Label htmlFor="title">Deal name</Label>
        <Input id="title" name="title" required maxLength={200} defaultValue={deal?.title} placeholder="Annual stock supply" />
      </div>
      {customers && (
        <div>
          <Label htmlFor="customerId">Customer</Label>
          <Select id="customerId" name="customerId" required defaultValue={customerId ?? ""}>
            <option value="" disabled>
              Choose a customer
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="value">Value ($)</Label>
          <Input id="value" name="value" type="number" min="0" step="0.01" defaultValue={deal?.value ?? ""} placeholder="0" />
        </div>
        <div>
          <Label htmlFor="stage">Stage</Label>
          <Select id="stage" name="stage" defaultValue={deal?.stage ?? "NEW"}>
            {DEAL_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="expectedClose">Expected close</Label>
          <Input id="expectedClose" name="expectedClose" type="date" defaultValue={dateInput(deal?.expectedClose)} />
        </div>
        <div>
          <Label htmlFor="ownerId">Owner</Label>
          <Select id="ownerId" name="ownerId" defaultValue={deal ? (deal.ownerId ?? "") : currentUserId}>
            <option value="">No owner</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        {deal && (
          <>
            <div>
              <Label htmlFor="probability">Chance of winning (%)</Label>
              <Input id="probability" name="probability" type="number" min="0" max="100" step="1" defaultValue={deal.probability} />
              <p className="mt-1 text-xs text-slate-500">Set by stage; change it if you know better.</p>
            </div>
            <div>
              <Label htmlFor="lostReason">Why it was lost (lost deals only)</Label>
              <Input id="lostReason" name="lostReason" maxLength={300} defaultValue={deal.lostReason ?? ""} placeholder="Chose a cheaper supplier" />
            </div>
          </>
        )}
      </div>
      <SubmitButton pendingText="Saving...">{submitLabel}</SubmitButton>
    </form>
  );
}
