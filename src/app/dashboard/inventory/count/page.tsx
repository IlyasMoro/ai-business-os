import { redirect } from "next/navigation";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { BackButton } from "@/components/ui-dark/back-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Select } from "@/components/ui-dark/input";
import { Button } from "@/components/ui-dark/button";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { submitStockCount } from "@/lib/actions/product-import";

export const metadata = { title: "Stock count" };

/** Count a branch's shelves and post every difference at once. Blank rows
 * weren't counted and stay as they are. */
export default async function StockCountPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; error?: string; why?: string; counted?: string; changed?: string }>;
}) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/inventory?error=forbidden");
  const { branch: branchParam, error, why, counted, changed } = await searchParams;

  const branches = await db.branch.findMany({
    where: { companyId: session.companyId, active: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const branch = branches.find((b) => b.id === branchParam) ?? branches[0];
  if (!branch) redirect("/dashboard/inventory");

  const products = await db.product.findMany({
    where: { companyId: session.companyId, trackingMode: "NONE" },
    orderBy: { name: "asc" },
    select: { id: true, sku: true, name: true, branchStock: { where: { branchId: branch.id }, select: { quantity: true } } },
  });
  const trackedCount = await db.product.count({ where: { companyId: session.companyId, trackingMode: { not: "NONE" } } });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/dashboard/inventory" label="Back to inventory" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Stock count</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400 light:text-slate-500">
          Type what you counted. Every difference is posted as a stock count correction in each product&apos;s history. Leave a row blank if you
          didn&apos;t count it.
          {trackedCount > 0 && ` ${trackedCount} lot or serial tracked product${trackedCount === 1 ? " is" : "s are"} counted through their lots instead.`}
        </p>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {why && <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{why}</p>}
          {counted && (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
              Count saved: {counted} product{counted === "1" ? "" : "s"} counted, {changed} adjusted.
            </p>
          )}
        </div>

        {branches.length > 1 && (
          <form method="GET" className="mt-4 flex items-end gap-3">
            <div>
              <Label htmlFor="branch">Branch</Label>
              <Select id="branch" name="branch" defaultValue={branch.id}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Show
            </Button>
          </form>
        )}

        {products.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No products to count.</p>
        ) : (
          <form action={submitStockCount} className="mt-6 rounded-2xl border border-white/[0.09] glass light:border-white/80">
            <input type="hidden" name="branchId" value={branch.id} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-slate-500 light:border-slate-200">
                    <th className="px-5 py-3 font-medium">Product</th>
                    <th className="px-5 py-3 text-right font-medium">In the system</th>
                    <th className="px-5 py-3 font-medium">Counted</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-5 py-2">
                        <p className="text-slate-50 light:text-slate-900">{p.name}</p>
                        <p className="font-mono text-xs text-slate-500">{p.sku}</p>
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-slate-300 light:text-slate-600">{p.branchStock[0]?.quantity ?? 0}</td>
                      <td className="px-5 py-2">
                        <Input name={`count_${p.id}`} type="number" min="0" step="1" aria-label={`Counted ${p.name}`} className="w-28" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] p-4 light:border-slate-200">
              <p className="text-xs text-slate-500">Counting {branch.name}.</p>
              <SubmitButton pendingText="Saving...">Save count</SubmitButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
