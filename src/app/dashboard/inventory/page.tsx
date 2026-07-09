import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { RingGauge } from "@/components/dash-viz/ring-gauge";
import { HorizontalBarChart } from "@/components/dash-viz/horizontal-bar-chart";
import { AnimatedCounter } from "@/components/dash-viz/animated-counter";
import { VIZ } from "@/components/dash-viz/colors";
import { formatCompactCurrency } from "@/lib/utils";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";

function inventoryHref(page: number, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard/inventory?${qs}` : "/dashboard/inventory";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = parsePage(pageParam);
  const session = await verifySession();

  const where: Prisma.ProductWhereInput = {
    companyId: session.companyId,
    ...(q
      ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }] }
      : {}),
  };

  const [products, totalCount, allForTotals] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where }),
    db.product.findMany({
      where: { companyId: session.companyId },
      select: { name: true, stockQty: true, reorderLevel: true, unitPrice: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const totalValue = allForTotals.reduce((s, p) => s + p.stockQty * p.unitPrice, 0);
  const lowStockCount = allForTotals.filter((p) => p.stockQty <= p.reorderLevel).length;
  const healthyRatio =
    allForTotals.length > 0 ? ((allForTotals.length - lowStockCount) / allForTotals.length) * 100 : 100;

  const topProductsByValue = allForTotals
    .map((p) => ({ label: p.name, value: p.stockQty * p.unitPrice }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {totalCount} product{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form method="GET" className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              placeholder="Search by name or SKU..."
              defaultValue={q}
              className="w-full rounded-md border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white py-2 pl-9 pr-3 text-sm text-slate-50 light:text-slate-900 placeholder:text-slate-500 outline-none transition-colors focus:border-blue-500"
            />
          </form>
          <Link
            href="/dashboard/inventory/new"
            className="inline-flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
          >
            <Plus className="h-4 w-4" />
            New product
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
          <p className="text-sm text-slate-400 light:text-slate-500">Inventory value</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50 light:text-slate-900">
            <AnimatedCounter value={totalValue} prefix="$" decimals={0} />
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
          <p className="text-sm text-slate-400 light:text-slate-500">Low stock items</p>
          <p className={`mt-2 text-2xl font-semibold ${lowStockCount > 0 ? "text-red-400" : "text-slate-50 light:text-slate-900"}`}>
            <AnimatedCounter value={lowStockCount} decimals={0} />
          </p>
        </div>
        <div className="flex items-center justify-center rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
          <RingGauge label="Stock health" pct={healthyRatio} goodIsHigh size={96} strokeWidth={8} />
        </div>
      </div>

      {topProductsByValue.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-50 light:text-slate-900">Top products by value</h2>
          <HorizontalBarChart data={topProductsByValue} color={VIZ.blue} />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
        {products.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q
              ? "No products match your search."
              : "No products yet. Add your first one to get started."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Unit price</th>
                <th className="px-5 py-3 font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3 font-mono text-xs text-slate-400 light:text-slate-500">{product.sku}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/inventory/${product.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono tabular-nums text-slate-300 light:text-slate-600">
                    {formatCompactCurrency(product.unitPrice)}
                  </td>
                  <td className="px-5 py-3">
                    {product.stockQty <= product.reorderLevel ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-xs tabular-nums text-red-400">
                        {product.stockQty} low
                      </span>
                    ) : (
                      <span className="font-mono tabular-nums text-slate-300 light:text-slate-600">{product.stockQty}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.06] light:border-slate-200 px-5 py-3">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={inventoryHref(page - 1, q)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700 light:text-slate-300">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={inventoryHref(page + 1, q)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-700 light:text-slate-300">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
