import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";

export function CustomerForm({
  action,
  defaultValues,
  campaigns,
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
  };
  campaigns?: { id: string; name: string }[];
  submitLabel?: string;
}) {
  return (
    <form action={action} className="max-w-xl space-y-4">
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
