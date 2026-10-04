import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { BackButton } from "@/components/ui-dark/back-button";
import { buttonStyles } from "@/components/ui-dark/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { CustomerImport } from "@/components/crm/customer-import";
import { IMPORT_FIELD_LABELS } from "@/lib/customer-import";

export const metadata = { title: "Import customers" };

export default async function ImportCustomersPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) redirect("/dashboard/crm?error=forbidden");
  const { error } = await searchParams;
  const campaigns = await db.campaign.findMany({
    where: { companyId: session.companyId, status: { not: "COMPLETED" } },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <BackButton href="/dashboard/crm" label="Back to customers" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Import customers</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400 light:text-slate-500">
              Bring customers over from a spreadsheet or another system. Nothing is saved until you have checked the file and confirmed.
            </p>
          </div>
          <a href="/api/export/customers?template=1" className={buttonStyles("secondary", "sm")}>
            <Download className="h-4 w-4" />
            Download template
          </a>
        </div>

        <div className="mt-4">
          <ErrorBanner code={error} />
        </div>

        <div className="mt-2 rounded-xl border border-white/[0.09] p-4 text-sm text-slate-400 glass light:border-white/80 light:text-slate-600">
          <p>
            Columns read: {Object.values(IMPORT_FIELD_LABELS).join(", ")}. Only Name is required, and headings from most other systems are
            recognised, as is a file exported from here.
          </p>
          <p className="mt-2">
            Customers whose email is already on file are skipped, so importing the same file twice is safe. Owner email must belong to
            someone on your team; otherwise you become the owner.
          </p>
        </div>

        <div className="mt-6">
          <CustomerImport campaigns={campaigns} />
        </div>
      </div>
    </div>
  );
}
