import { Label, Select } from "@/components/ui-dark/input";

/**
 * Branch field where "none" is a valid answer (a company wide cost center
 * or entry). Render only when moneyBranchPicker returned options.
 */
export function OptionalBranchSelect({
  options,
  defaultId,
  emptyLabel,
  label = "Branch",
}: {
  options: { id: string; name: string; code: string }[];
  defaultId: string;
  emptyLabel: string;
  label?: string;
}) {
  return (
    <div>
      <Label htmlFor="branchId">{label}</Label>
      <Select id="branchId" name="branchId" defaultValue={defaultId}>
        <option value="">{emptyLabel}</option>
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.code})
          </option>
        ))}
      </Select>
    </div>
  );
}
