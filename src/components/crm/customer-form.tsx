import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { LEAD_SOURCES } from "@/lib/crm-pipeline";

export function CustomerForm({
  action,
  defaultValues,
  campaigns,
  users,
  currentUserId,
  submitLabel = "Save customer",
}: {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    status: string;
    notes: string | null;
    campaignId?: string | null;
    creditLimit?: number | null;
    source?: string | null;
    ownerId?: string | null;
  };
  campaigns?: { id: string; name: string }[];
  /** People who can own the account; a new customer defaults to `currentUserId`. */
  users: { id: string; name: string }[];
  currentUserId: string;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaultValues?.email ?? ""} />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={defaultValues?.phone ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" defaultValue={defaultValues?.company ?? ""} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={defaultValues?.status ?? "LEAD"}>
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ownerId">Account owner</Label>
          <Select id="ownerId" name="ownerId" defaultValue={defaultValues ? (defaultValues.ownerId ?? "") : currentUserId}>
            <option value="">No owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="source">Lead source</Label>
          <Select id="source" name="source" defaultValue={defaultValues?.source ?? ""}>
            <option value="">Not known</option>
            {LEAD_SOURCES.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="creditLimit">Credit limit (optional)</Label>
        <Input
          id="creditLimit"
          name="creditLimit"
          type="number"
          min="0"
          step="0.01"
          placeholder="No limit enforced"
          defaultValue={defaultValues?.creditLimit ?? ""}
        />
        <p className="mt-1 text-xs text-slate-500">
          Orders that would push this customer&apos;s unpaid balance over this amount get blocked at
          confirmation. Leave blank for no limit.
        </p>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={4} defaultValue={defaultValues?.notes ?? ""} />
      </div>

      {campaigns && campaigns.length > 0 && (
        <div>
          <Label htmlFor="campaignId">Source campaign (optional)</Label>
          <Select id="campaignId" name="campaignId" defaultValue={defaultValues?.campaignId ?? ""}>
            <option value="">None</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <SubmitButton pendingText="Saving...">{submitLabel}</SubmitButton>
    </form>
  );
}
