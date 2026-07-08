import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { LinkButton } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { deleteProduct } from "@/lib/actions/inventory";
import { Pencil } from "lucide-react";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifySession();

  const product = await db.product.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!product) notFound();

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <div className="max-w-3xl">
        {error === "in-use" && (
          <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            This product can&apos;t be deleted because it&apos;s used in an existing order.
          </p>
        )}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50">{product.name}</h1>
              {product.stockQty <= product.reorderLevel && (
                <Badge tone="red">Low stock</Badge>
              )}
            </div>
            <p className="mt-1 text-slate-400">{product.sku}</p>
          </div>
          <div className="flex items-center gap-2">
            <LinkButton href={`/dashboard/inventory/${product.id}/edit`} variant="secondary" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </LinkButton>
            <DeleteButton action={deleteProduct.bind(null, product.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Cost</p>
              <p className="font-mono tabular-nums text-slate-50">${product.cost.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Unit price</p>
              <p className="font-mono tabular-nums text-slate-50">${product.unitPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Stock quantity</p>
              <p className="font-mono tabular-nums text-slate-50">{product.stockQty}</p>
            </div>
            <div>
              <p className="text-slate-500">Reorder level</p>
              <p className="font-mono tabular-nums text-slate-50">{product.reorderLevel}</p>
            </div>
            {product.description && (
              <div className="col-span-2">
                <p className="text-slate-500">Description</p>
                <p className="whitespace-pre-wrap text-slate-50">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6">
          <Link href="/dashboard/inventory" className="text-sm text-slate-500 hover:text-slate-300">
            ← Back to inventory
          </Link>
        </p>
      </div>
    </div>
  );
}
