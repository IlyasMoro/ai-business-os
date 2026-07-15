import Link from "next/link";
import { Label, Select, Input } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { createPurchaseOrder } from "@/lib/actions/procurement";

export function PurchaseOrderForm({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) {
  if (suppliers.length === 0) {
    return (
      <p className="text-sm text-slate-400 light:text-slate-500">
        You need a supplier before creating a purchase order.{" "}
        <Link href="/dashboard/procurement/suppliers" className="text-blue-400 hover:text-blue-300">
          Add one first
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={createPurchaseOrder} className="max-w-xl space-y-4">
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
      <SubmitButton pendingText="Creating...">Create purchase order</SubmitButton>
    </form>
  );
}
