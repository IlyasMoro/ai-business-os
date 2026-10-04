"use client";

import { useState } from "react";
import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { CUSTOM_FIELD_TYPES, type CustomFieldType } from "@/lib/custom-fields";

/** Adds a custom field; the choices box shows only for a dropdown list. */
export function NewFieldForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [type, setType] = useState<CustomFieldType>("TEXT");
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <Label htmlFor="new-field-label">Field name</Label>
          <Input id="new-field-label" name="label" required maxLength={60} placeholder="For example, Industry" />
        </div>
        <div>
          <Label htmlFor="new-field-type">Type</Label>
          <Select id="new-field-type" name="type" value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>
            {CUSTOM_FIELD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {type === "SELECT" && (
        <div>
          <Label htmlFor="new-field-options">Choices, one per line</Label>
          <Textarea id="new-field-options" name="options" rows={4} placeholder={"Retail\nWholesale\nManufacturing"} />
        </div>
      )}
      <SubmitButton variant="secondary" pendingText="Adding...">
        Add field
      </SubmitButton>
    </form>
  );
}
