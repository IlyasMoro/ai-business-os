import { redirect } from "next/navigation";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { BackButton } from "@/components/ui-dark/back-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ProductImport } from "@/components/inventory/product-import";
import { PRODUCT_IMPORT_FIELD_LABELS } from "@/lib/product-import";

export const metadata = { title: "Import products" };

export default async function ImportProductsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/inventory?error=forbidden");
  const { error } = await searchParams;
  const branches = await db.branch.findMany({
    where: { companyId: session.companyId, active: true },
    orderBy: [{ isMain: "desc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/dashboard/inventory" label="Back to inventory" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Import products</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400 light:text-slate-500">
          Bring products over from a spreadsheet or another system. Nothing is saved until you have checked the file and confirmed.
        </p>
        <div className="mt-4">
          <ErrorBanner code={error} />
        </div>
        <div className="mt-2 rounded-xl border border-white/[0.09] p-4 text-sm text-slate-400 glass light:border-white/80 light:text-slate-600">
          <p>
            Columns read: {Object.values(PRODUCT_IMPORT_FIELD_LABELS).join(", ")}. SKU and Name are required, and headings from most other systems
            are recognised.
          </p>
          <p className="mt-2">
            Products whose SKU is already on file are skipped, so importing the same file twice is safe. Opening stock is recorded in each
            product&apos;s stock history.
          </p>
        </div>
        <div className="mt-6">
          <ProductImport branches={branches} />
        </div>
      </div>
    </div>
  );
}
