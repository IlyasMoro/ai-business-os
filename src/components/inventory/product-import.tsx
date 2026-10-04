"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui-dark/button";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { Label, Select } from "@/components/ui-dark/input";
import { importProducts, previewProductImport, type ProductImportPreviewState } from "@/lib/actions/product-import";

function Issues({ title, tone, items }: { title: string; tone: "red" | "amber" | "slate"; items: { line: number; message: string }[] }) {
  if (items.length === 0) return null;
  const color = { red: "text-red-400 light:text-red-700", amber: "text-amber-400 light:text-amber-700", slate: "text-slate-400 light:text-slate-600" }[tone];
  return (
    <details className="rounded-lg border border-white/[0.08] p-3 light:border-slate-200" open={items.length <= 5}>
      <summary className={`cursor-pointer text-sm font-medium ${color}`}>
        {title} ({items.length})
      </summary>
      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-sm text-slate-300 light:text-slate-700">
        {items.map((item, i) => (
          <li key={i}>
            <span className="tabular-nums text-slate-500">Row {item.line}:</span> {item.message}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Step 1 checks the file and shows what will happen; step 2 imports it,
 * with opening stock going to the chosen branch. */
export function ProductImport({ branches }: { branches: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ProductImportPreviewState, FormData>(previewProductImport, undefined);
  const plan = state?.plan;
  const money = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="space-y-6">
      <form action={formAction} className="rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
        <label htmlFor="file" className="block text-sm font-medium text-slate-200 light:text-slate-800">
          CSV file
        </label>
        <p className="mt-1 text-xs text-slate-500">Up to 2,000 products and 1MB. The first row must be the column headings.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full max-w-sm text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-white/15 light:text-slate-700 light:file:bg-slate-200 light:file:text-slate-800"
          />
          <Button type="submit" variant="secondary" disabled={pending}>
            <Upload className="h-4 w-4" />
            {pending ? "Checking..." : plan ? "Check another file" : "Check file"}
          </Button>
        </div>
        {state?.error && <p className="mt-3 text-sm text-red-400 light:text-red-700">{state.error}</p>}
      </form>

      {plan && state?.csv && (
        <div className="space-y-4 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <div>
            <h2 className="text-lg font-semibold text-slate-50 light:text-slate-900">{state.fileName}</h2>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              {plan.readyCount} ready to import
              {plan.duplicates.length > 0 && `, ${plan.duplicates.length} already on file`}
              {plan.problems.length > 0 && `, ${plan.problems.length} with problems`}.
              {plan.ignoredColumns.length > 0 && ` Columns not used: ${plan.ignoredColumns.join(", ")}.`}
            </p>
          </div>

          {plan.sample.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-white/[0.08] light:border-slate-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-slate-500 light:border-slate-200">
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">Opening stock</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.sample.map((p) => (
                    <tr key={p.line} className="border-b border-white/[0.04] last:border-0 light:border-slate-100">
                      <td className="px-3 py-2 font-mono text-slate-300 light:text-slate-700">{p.sku}</td>
                      <td className="px-3 py-2 text-slate-100 light:text-slate-900">{p.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-400 light:text-slate-600">{money(p.cost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-400 light:text-slate-600">{money(p.unitPrice)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-400 light:text-slate-600">{p.stockQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plan.readyCount > plan.sample.length && (
                <p className="border-t border-white/[0.06] px-3 py-2 text-xs text-slate-500 light:border-slate-200">And {plan.readyCount - plan.sample.length} more.</p>
              )}
            </div>
          )}

          <Issues title="Not imported: problems" tone="red" items={plan.problems} />
          <Issues
            title="Skipped: SKU already on file or repeated"
            tone="slate"
            items={plan.duplicates.map((d) => ({ line: d.line, message: `${d.name} (${d.sku})` }))}
          />
          <Issues title="Imported with changes" tone="amber" items={plan.warnings} />

          {plan.readyCount > 0 ? (
            <form action={importProducts} className="space-y-4">
              <input type="hidden" name="csv" value={state.csv} />
              {branches.length > 1 ? (
                <div className="max-w-sm">
                  <Label htmlFor="branchId">Opening stock goes to</Label>
                  <Select id="branchId" name="branchId" defaultValue={branches[0].id}>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <input type="hidden" name="branchId" value={branches[0]?.id ?? ""} />
              )}
              <SubmitButton pendingText="Importing...">
                Import {plan.readyCount} {plan.readyCount === 1 ? "product" : "products"}
              </SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-slate-400">Nothing new to import from this file.</p>
          )}
        </div>
      )}
    </div>
  );
}
