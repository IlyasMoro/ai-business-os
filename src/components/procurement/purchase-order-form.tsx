import Link from "next/link";
import { Label, Select, Input } from "@/components/ui-dark/input";
import { BranchSelect, type BranchPicker } from "@/components/layout/branch-select";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { createPurchaseOrder } from "@/lib/actions/procurement";

export function PurchaseOrderForm({
  suppliers,
  branches,
}: {
  suppliers: { id: string; name: string }[];
  branches?: BranchPicker | null;
}) {
  if (suppliers.length === 0) {
    return (
      <p className="text-sm text-slate-400 light:text-slate-500">
        You need a supplier before creating a purchase order.{" "}
        <Link href="/dashboard/procurement/suppliers" className="text-cyan-300 hover:text-cyan-200 light:text-cyan-800 light:hover:text-cyan-900">
          Add one first
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={createPurchaseOrder} className="space-y-4">
      <div>
        <Label htmlFor="supplierId">Supplier</Label>
        <Select id="supplierId" name="supplierId" defaultValue="" required>
          <option value="" disabled>
            Select a supplier
          </option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="expectedDate">Expected delivery date (optional)</Label>
        <Input id="expectedDate" name="expectedDate" type="date" />
      </div>
      {branches && <BranchSelect {...branches} />}

      <SubmitButton pendingText="Creating...">Create purchase order</SubmitButton>
    </form>
  );
}
