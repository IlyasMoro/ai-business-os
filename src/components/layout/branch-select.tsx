import { Label, Select } from "@/components/ui-dark/input";

export type BranchPicker = {
  options: { id: string; name: string; code: string }[];
  defaultId: string;
};

/** "Branch" field for create forms. The server still validates the choice. */
export function BranchSelect({ options, defaultId }: BranchPicker) {
  return (
    <div>
      <Label htmlFor="branchId">Branch</Label>
      <Select id="branchId" name="branchId" defaultValue={defaultId}>
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.code})
          </option>
        ))}
      </Select>
    </div>
  );
}
