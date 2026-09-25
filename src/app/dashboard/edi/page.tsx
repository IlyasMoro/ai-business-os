import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Badge, StatusBadge } from "@/components/ui-dark/badge";
import { ErrorBanner } from "@/components/ui/error-banner";
import { getEdiSettings } from "@/lib/edi/settings";
import { parsePage, PAGE_SIZE } from "@/lib/pagination";
import { DOC_TYPE_LABEL } from "@/lib/edi/labels";
import { ArrowDownToLine, ArrowUpFromLine, Settings2, Upload, Users, ChevronLeft, ChevronRight } from "lucide-react";

const statusTone = { GENERATED: "blue", PROCESSED: "green", REJECTED: "red" } as const;

export default async function EdiPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; error?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { page: pageParam, error } = await searchParams;
  const page = parsePage(pageParam);
  const settings = await getEdiSettings(session.companyId);

  const where = { companyId: session.companyId };
  const [docs, totalCount, counts, partnerCount] = await Promise.all([
    db.ediDocument.findMany({
      where,
      include: { partner: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.ediDocument.count({ where }),
    db.ediDocument.groupBy({ by: ["direction", "status"], where, _count: { _all: true } }),
    db.ediPartner.count({ where }),
  ]);
  const count = (direction: string, status?: string) =>
    counts.filter((c) => c.direction === direction && (!status || c.status === status)).reduce((s, c) => s + c._count._all, 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const buttonClass =
    "inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-white/[0.06] light:border-slate-200 px-4 py-2 text-sm font-medium text-slate-300 light:text-slate-600 transition-colors hover:bg-white/5";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">EDI</h1>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {settings
              ? `ANSI X12 ${settings.version === "005010" ? "5010" : "4010"} as ${settings.isaQualifier}:${settings.isaId}, ${settings.usageIndicator === "P" ? "production" : "test"} mode`
              : "Exchange purchase orders, invoices and ship notices with trading partners."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard/edi/partners" className={buttonClass}>
            <Users className="h-4 w-4" />
            Partners ({partnerCount})
          </Link>
          <Link href="/dashboard/edi/settings" className={buttonClass}>
            <Settings2 className="h-4 w-4" />
            Settings
          </Link>
          {settings?.enabled && (
            <Link
              href="/dashboard/edi/import"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20 light:border-blue-600/30 light:bg-blue-600/10 light:text-blue-700 light:hover:bg-blue-600/15"
            >
              <Upload className="h-4 w-4" />
              Import file
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4">
        <ErrorBanner code={error} />
        {!settings && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            EDI isn&apos;t set up yet.{" "}
            <Link href="/dashboard/edi/settings" className="underline hover:text-amber-200">
              Enter your EDI identity
            </Link>{" "}
            to start exchanging files.
          </p>
        )}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
          <p className="flex items-center gap-2 text-sm text-slate-400 light:text-slate-500">
            <ArrowDownToLine className="h-4 w-4" /> Received and processed
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">{count("INBOUND", "PROCESSED")}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
          <p className="flex items-center gap-2 text-sm text-slate-400 light:text-slate-500">
            <ArrowDownToLine className="h-4 w-4" /> Received and rejected
          </p>
          <p className="mt-2 text-2xl font-semibold text-red-400">{count("INBOUND", "REJECTED")}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.09] light:border-white/80 p-5 glass">
          <p className="flex items-center gap-2 text-sm text-slate-400 light:text-slate-500">
            <ArrowUpFromLine className="h-4 w-4" /> Generated to send
          </p>
          <p className="mt-2 text-2xl font-semibold text-blue-400">{count("OUTBOUND")}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.09] light:border-white/80 glass">
        {docs.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No EDI documents yet. Import a customer&apos;s purchase order, or generate one from a purchase order, invoice or
            fulfilled sales order.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] light:border-slate-200 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Direction</th>
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="px-5 py-3 font-medium">Partner</th>
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <Badge tone={doc.direction === "INBOUND" ? "purple" : "slate"}>
                      {doc.direction === "INBOUND" ? "In" : "Out"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/edi/${doc.id}`} className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400">
                      <span className="font-mono">{doc.docType === "unknown" ? "?" : doc.docType}</span>{" "}
                      {DOC_TYPE_LABEL[doc.docType] ?? doc.docType}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{doc.partner?.name ?? "Unknown"}</td>
                  <td className="px-5 py-3 font-mono text-slate-400 light:text-slate-500">{doc.reference ?? ""}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={doc.status} tone={statusTone[doc.status]} />
                  </td>
                  <td className="px-5 py-3 text-slate-400 light:text-slate-500">{doc.createdAt.toLocaleString()}</td>
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
              {page > 1 && (
                <Link href={`/dashboard/edi?page=${page - 1}`} className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 hover:bg-white/5">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link href={`/dashboard/edi?page=${page + 1}`} className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-300 light:text-slate-600 hover:bg-white/5">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
