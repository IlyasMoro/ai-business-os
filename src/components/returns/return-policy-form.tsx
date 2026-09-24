import { Input, Label, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { updateReturnPolicy } from "@/lib/actions/returns";
import type { ReturnPolicyValues } from "@/lib/returns-policy-presets";

function Toggle({ name, label, description, defaultChecked }: { name: string; label: string; description: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-medium text-slate-50 light:text-slate-900">{label}</span>
        <span className="mt-0.5 block text-sm text-slate-400 light:text-slate-500">{description}</span>
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-white/10 transition-colors has-[:checked]:bg-emerald-500/80 light:bg-slate-200">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-slate-300 transition-transform peer-checked:translate-x-5 peer-checked:bg-white" />
      </span>
    </label>
  );
}

export function ReturnPolicyForm({ policy }: { policy: ReturnPolicyValues }) {
  return (
    <form action={updateReturnPolicy} className="space-y-5">
      <Toggle
        name="enabled"
        label="Accept returns"
        description="Turn this off if your business doesn't sell physical goods. The Returns page is hidden while it's off."
        defaultChecked={policy.enabled}
      />
      <Toggle
        name="requireApproval"
        label="Require approval"
        description="When on, new returns wait for someone to approve them. When off, they start already approved."
        defaultChecked={policy.requireApproval}
      />
      <Toggle
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
