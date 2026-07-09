import { Input, Label, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { createSupplier } from "@/lib/actions/procurement";

export function SupplierForm() {
  return (
    <form action={createSupplier} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={1} />
      </div>
      <div className="col-span-2 flex items-end sm:col-span-1">
        <SubmitButton variant="secondary" pendingText="Adding...">
          Add supplier
        </SubmitButton>
      </div>
    </form>
  );
}
