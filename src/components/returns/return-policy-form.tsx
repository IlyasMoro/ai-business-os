import { Input, Label, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { updateReturnPolicy } from "@/lib/actions/returns";
import type { ReturnPolicyValues } from "@/lib/returns-policy-presets";
import { SettingToggle } from "@/components/ui-dark/setting-toggle";

export function ReturnPolicyForm({ policy }: { policy: ReturnPolicyValues }) {
  return (
    <form action={updateReturnPolicy} className="space-y-5">
      <SettingToggle
        name="enabled"
        label="Accept returns"
        description="Turn this off if your business doesn't sell physical goods. The Returns page is hidden while it's off."
        defaultChecked={policy.enabled}
      />
      <SettingToggle
        name="requireApproval"
        label="Require approval"
        description="When on, new returns wait for someone to approve them. When off, they start already approved."
        defaultChecked={policy.requireApproval}
      />
      <SettingToggle
        name="restockDamaged"
        label="Restock damaged goods"
        description="When off, only items marked resellable go back into inventory when a return is received."
        defaultChecked={policy.restockDamaged}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="windowDays">Return window (days)</Label>
          <Input id="windowDays" name="windowDays" type="number" min="0" max="3650" step="1" defaultValue={policy.windowDays} required />
          <p className="mt-1 text-xs text-slate-500">Counted from when the order was fulfilled. Use 0 for no limit.</p>
        </div>
        <div>
          <Label htmlFor="restockingFeePercent">Restocking fee (%)</Label>
          <Input
            id="restockingFeePercent"
            name="restockingFeePercent"
            type="number"
            min="0"
            max="100"
            step="0.5"
            defaultValue={policy.restockingFeePercent}
            required
          />
          <p className="mt-1 text-xs text-slate-500">Kept back from every refund. Use 0 for full refunds.</p>
        </div>
      </div>
      <div>
        <Label htmlFor="reasons">Return reasons</Label>
        <Textarea id="reasons" name="reasons" rows={5} defaultValue={policy.reasons} maxLength={2000} />
        <p className="mt-1 text-xs text-slate-500">One per line. &quot;Other&quot; is always offered as well.</p>
      </div>
      <SubmitButton pendingText="Saving...">Save policy</SubmitButton>
    </form>
  );
}
