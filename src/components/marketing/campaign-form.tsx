import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { createCampaign } from "@/lib/actions/marketing";

export function CampaignForm() {
  return (
    <form action={createCampaign} className="max-w-xl space-y-4">
      <div>
        <Label htmlFor="name">Campaign name</Label>
        <Input id="name" name="name" placeholder="Spring Promo" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="channel">Channel</Label>
          <Select id="channel" name="channel" defaultValue="OTHER">
            <option value="EMAIL">Email</option>
            <option value="SOCIAL">Social</option>
            <option value="ADS">Ads</option>
            <option value="EVENT">Event</option>
            <option value="REFERRAL">Referral</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="budget">Budget</Label>
          <Input id="budget" name="budget" type="number" min="0" step="0.01" defaultValue={0} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        <div>
          <Label htmlFor="endDate">End date</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>
      <SubmitButton pendingText="Creating...">Create campaign</SubmitButton>
    </form>
  );
}
