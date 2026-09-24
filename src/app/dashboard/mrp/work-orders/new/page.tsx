import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { getMrpSettings } from "@/lib/mrp";
import { createWorkOrder } from "@/lib/actions/mrp";

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; productId?: string }>;
}) {
  const { error, productId } = await searchParams;
  const session = await verifySession();
  const settings = await getMrpSettings(session.companyId);
  if (!settings.enabled) redirect("/dashboard/mrp");

  // Only products with a bill of materials can be made.
  const products = await db.product.findMany({
    where: { companyId: session.companyId, bomComponents: { some: {} } },
    select: { id: true, name: true, sku: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New work order</h1>
      <div className="mt-6 max-w-xl">
        <ErrorBanner code={error} />
        {products.length === 0 ? (
          <p className="text-sm text-slate-400 light:text-slate-500">
            No products have a bill of materials yet. Open a product in{" "}
            <Link href="/dashboard/inventory" className="text-blue-400 hover:text-blue-300">
              Inventory
            </Link>{" "}
            and add its components first.
          </p>
        ) : (
          <form action={createWorkOrder} className="space-y-4">
            <div>
              <Label htmlFor="productId">Product to make</Label>
              <Select
                id="productId"
                name="productId"
                defaultValue={products.some((p) => p.id === productId) ? productId : ""}
                required
              >
                <option value="" disabled>
                  Select a product
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" min="1" step="1" defaultValue={1} required />
              </div>
              <div>
                <Label htmlFor="dueDate">Due date (optional)</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" rows={3} maxLength={2000} />
            </div>
            <SubmitButton pendingText="Creating...">Create work order</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
