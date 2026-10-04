import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";

type CampaignValues = {
  name: string;
  channel: string;
  budget: number;
  spent: number;
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
};

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : undefined);

/** New campaign, or (with `campaign`) editing one. */
export function CampaignForm({ action, campaign }: { action: (formData: FormData) => void | Promise<void>; campaign?: CampaignValues }) {
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">Campaign name</Label>
        <Input id="name" name="name" placeholder="Spring Promo" defaultValue={campaign?.name} required maxLength={200} />
      </div>
      <div>
        <Label htmlFor="channel">Channel</Label>
        <Select id="channel" name="channel" defaultValue={campaign?.channel ?? "OTHER"}>
          <option value="EMAIL">Email</option>
          <option value="SOCIAL">Social</option>
          <option value="ADS">Ads</option>
          <option value="EVENT">Event</option>
          <option value="REFERRAL">Referral</option>
          <option value="OTHER">Other</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="budget">Budget</Label>
          <Input id="budget" name="budget" type="number" min="0" step="0.01" defaultValue={campaign?.budget ?? 0} required />
        </div>
        <div>
          <Label htmlFor="spent">Spent so far</Label>
          <Input id="spent" name="spent" type="number" min="0" step="0.01" defaultValue={campaign?.spent ?? 0} />
          <p className="mt-1 text-xs text-slate-500">Cost per lead and return use this, not the budget.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={day(campaign?.startDate)} />
        </div>
        <div>
          <Label htmlFor="endDate">End date</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={day(campaign?.endDate)} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={campaign?.notes ?? undefined} />
      </div>
      <SubmitButton pendingText={campaign ? "Saving..." : "Creating..."}>{campaign ? "Save changes" : "Create campaign"}</SubmitButton>
    </form>
  );
}
