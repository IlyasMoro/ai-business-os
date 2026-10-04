"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { Button } from "@/components/ui-dark/button";
import { adjustStock } from "@/lib/actions/inventory";
import { ADJUSTMENT_REASONS } from "@/lib/stock-history";
import type { StockAdjustState } from "@/lib/validation/inventory";

/** Owners and admins correct stock here; every change is recorded in the
 * product's stock history with the reason. */
export function StockAdjustForm({
  productId,
  branches,
}: {
  productId: string;
  /** Active branches with their current count; one branch hides the picker. */
  branches: { id: string; name: string; quantity: number }[];
}) {
  const action = adjustStock.bind(null, productId) as (state: StockAdjustState, formData: FormData) => Promise<StockAdjustState>;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [mode, setMode] = useState<"count" | "change">("count");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const current = branches.find((b) => b.id === branchId)?.quantity ?? 0;

  // Clear the numbers only after a successful adjustment. Submitting by hand
  // (not the form's action prop) stops React clearing the form after an
  // error too, which would make people type everything again.
  useEffect(() => {
    if (!state?.ok || !formRef.current) return;
    // Only the typed values; the branch and type dropdowns keep their choice.
    for (const name of ["quantity", "note"]) {
      const field = formRef.current.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = "";
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {branches.length > 1 ? (
          <div>
            <Label htmlFor="adjust-branch">Branch</Label>
            <Select id="adjust-branch" name="branchId" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.quantity} on hand)
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <input type="hidden" name="branchId" value={branchId} />
        )}
        <div>
          <Label htmlFor="adjust-mode">Type</Label>
          <Select id="adjust-mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as "count" | "change")}>
            <option value="count">I counted the stock</option>
            <option value="change">Add or remove some</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="adjust-quantity">{mode === "count" ? "Counted quantity" : "Change (use a minus to remove)"}</Label>
          <Input id="adjust-quantity" name="quantity" type="number" step="1" required placeholder={mode === "count" ? String(current) : "-2"} />
          <p className="mt-1 text-xs text-slate-500">{current} on hand now.</p>
        </div>
        <div>
          <Label htmlFor="adjust-reason">Reason</Label>
          <Select id="adjust-reason" name="reason" defaultValue={mode === "count" ? "COUNT" : "DAMAGED"} key={mode}>
            {ADJUSTMENT_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="adjust-note">Note</Label>
        <Input id="adjust-note" name="note" maxLength={500} placeholder="Optional, required for Other" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving..." : "Adjust stock"}
        </Button>
        {state?.message && <p className="text-sm text-red-400 light:text-red-700">{state.message}</p>}
        {state?.ok && <p className="text-sm text-emerald-400 light:text-emerald-700">Stock adjusted and recorded.</p>}
      </div>
    </form>
  );
}
