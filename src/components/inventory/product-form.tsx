"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui-dark/input";
import { UNIT_LABELS, qtyStep, type Unit } from "@/lib/quantity";
import { BranchSelect, type BranchPicker } from "@/components/layout/branch-select";
import type { ProductFormState } from "@/lib/validation/inventory";

type Action = (
  state: ProductFormState,
  formData: FormData
) => Promise<ProductFormState>;

export function ProductForm({
  action,
  defaultValues,
  submitLabel = "Save product",
  branches,
  editing = false,
}: {
  action: Action;
  defaultValues?: {
    sku: string;
    name: string;
    description: string | null;
    cost: number;
    unitPrice: number;
    reorderLevel: number;
    unit?: Unit;
  };
  submitLabel?: string;
  /** New products: which branch the opening stock goes to. */
  branches?: BranchPicker | null;
  /** Editing an existing product: no stock field, since stock changes
   * through a recorded adjustment on the product page. */
  editing?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  // Stock and reorder fields take decimals once the product is weighed.
  const [unit, setUnit] = useState<Unit>(defaultValues?.unit ?? "EACH");
  const step = qtyStep(unit);
  const per = unit === "KG" ? " per kg" : unit === "L" ? " per litre" : "";

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" defaultValue={defaultValues?.sku} required />
          <FieldError messages={state?.errors?.sku} />
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={defaultValues?.name} required />
          <FieldError messages={state?.errors?.name} />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
        />
        <FieldError messages={state?.errors?.description} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cost">Cost{per}</Label>
          <Input
            id="cost"
            name="cost"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.cost ?? 0}
            required
          />
          <FieldError messages={state?.errors?.cost} />
        </div>
        <div>
          <Label htmlFor="unitPrice">{per ? `Price${per}` : "Unit price"}</Label>
          <Input
            id="unitPrice"
            name="unitPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.unitPrice}
            required
          />
          <FieldError messages={state?.errors?.unitPrice} />
        </div>
      </div>
      <div>
        <Label htmlFor="unit">Sold by</Label>
        <Select id="unit" name="unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
          {(Object.keys(UNIT_LABELS) as Unit[]).map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-slate-500">
          {unit === "EACH"
            ? "Counted by the piece: quantities are whole numbers."
            : `Sold by ${unit === "KG" ? "weight" : "volume"}: quantities take up to 3 decimals, for example 1.35${unit === "KG" ? " kg" : " L"}.`}
        </p>
        <FieldError messages={state?.errors?.unit} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {editing ? (
          <div>
            <p className="text-sm font-medium text-slate-300 light:text-slate-600">Stock</p>
            <p className="mt-1.5 text-xs text-slate-500">
              Change stock with Adjust stock on the product page, so every change is recorded with a reason.
            </p>
          </div>
        ) : (
          <div>
            <Label htmlFor="stockQty">Opening stock</Label>
            <Input id="stockQty" name="stockQty" type="number" step={step} min="0" defaultValue={0} required />
            <FieldError messages={state?.errors?.stockQty} />
          </div>
        )}
        <div>
          <Label htmlFor="reorderLevel">Reorder level</Label>
          <Input
            id="reorderLevel"
            name="reorderLevel"
            type="number"
            step={step}
            min="0"
            defaultValue={defaultValues?.reorderLevel ?? 5}
            required
          />
          <FieldError messages={state?.errors?.reorderLevel} />
        </div>
      </div>

      {branches && <BranchSelect {...branches} />}

      {state?.message && <p className="text-sm text-red-400 light:text-red-700">{state.message}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
