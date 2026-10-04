import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { LEAD_SOURCES } from "@/lib/crm-pipeline";
import { tagColor } from "@/lib/crm-tags";
import { fieldInputName, type CustomFieldDef, type CustomValues } from "@/lib/custom-fields";
import { cn } from "@/lib/utils";

export function CustomerForm({
  action,
  defaultValues,
  campaigns,
  users,
  currentUserId,
  submitLabel = "Save customer",
  tags = [],
  selectedTagIds = [],
  fields = [],
  values = {},
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
    creditLimit?: number | null;
    source?: string | null;
    ownerId?: string | null;
  };
  campaigns?: { id: string; name: string }[];
  /** People who can own the account; a new customer defaults to `currentUserId`. */
  users: { id: string; name: string }[];
  currentUserId: string;
  submitLabel?: string;
  /** The company's tags, and the ones this customer has. */
  tags?: { id: string; name: string; color: string }[];
  selectedTagIds?: string[];
  /** The company's own fields, and this customer's values for them. */
  fields?: CustomFieldDef[];
  values?: CustomValues;
}) {
  const selected = new Set(selectedTagIds);
  return (
    <form action={action} className="space-y-4">
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ownerId">Account owner</Label>
          <Select id="ownerId" name="ownerId" defaultValue={defaultValues ? (defaultValues.ownerId ?? "") : currentUserId}>
            <option value="">No owner</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="source">Lead source</Label>
          <Select id="source" name="source" defaultValue={defaultValues?.source ?? ""}>
            <option value="">Not known</option>
            {LEAD_SOURCES.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="creditLimit">Credit limit (optional)</Label>
        <Input
          id="creditLimit"
          name="creditLimit"
          type="number"
          min="0"
          step="0.01"
          placeholder="No limit enforced"
          defaultValue={defaultValues?.creditLimit ?? ""}
        />
        <p className="mt-1 text-xs text-slate-500">
          Orders that would push this customer&apos;s unpaid balance over this amount get blocked at
          confirmation. Leave blank for no limit.
        </p>
      </div>
      {tags.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-slate-300 light:text-slate-600">Tags</legend>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <label key={tag.id} className="cursor-pointer">
                <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={selected.has(tag.id)} className="peer sr-only" />
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium opacity-60 transition peer-checked:opacity-100 peer-checked:ring-1 peer-checked:ring-current peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500",
                    tagColor(tag.color).chip
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", tagColor(tag.color).dot)} aria-hidden />
                  {tag.name}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Click a tag to add or remove it.</p>
        </fieldset>
      )}

      {fields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const name = fieldInputName(field.id);
            const value = values[field.id];
            return (
              <div key={field.id}>
                <Label htmlFor={name}>{field.label}</Label>
                {field.type === "SELECT" ? (
                  <Select id={name} name={name} defaultValue={value === undefined ? "" : String(value)}>
                    <option value="">Not set</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={name}
                    name={name}
                    type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
                    step={field.type === "NUMBER" ? "any" : undefined}
                    maxLength={field.type === "TEXT" ? 500 : undefined}
                    defaultValue={value === undefined ? "" : String(value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

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
