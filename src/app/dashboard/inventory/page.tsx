import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { SearchForm } from "@/components/ui/search-form";
import { Pagination } from "@/components/ui/pagination";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { Plus } from "lucide-react";

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

  const [products, totalCount] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">
            {totalCount} product{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SearchForm placeholder="Search by name or SKU..." defaultValue={q} />
          <LinkButton href="/dashboard/inventory/new">
            <Plus className="h-4 w-4" />
            New product
          </LinkButton>
        </div>
      </div>

      <Card className="mt-6">
        {products.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {q
              ? "No products match your search."
              : "No products yet. Add your first one to get started."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Unit price</th>
                <th className="px-5 py-3 font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 text-slate-600">{product.sku}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/inventory/${product.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    ${product.unitPrice.toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    {product.stockQty <= product.reorderLevel ? (
                      <Badge tone="red">{product.stockQty} low</Badge>
                    ) : (
                      <span className="text-slate-600">{product.stockQty}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} basePath="/dashboard/inventory" query={{ q }} />
      </Card>
    </div>
  );
}
