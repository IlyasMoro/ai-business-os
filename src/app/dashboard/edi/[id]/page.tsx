import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge, StatusBadge } from "@/components/ui-dark/badge";
import { DOC_TYPE_LABEL, prettyX12 } from "@/lib/edi/labels";
import { Download } from "lucide-react";
import { buttonStyles } from "@/components/ui-dark/button";

const statusTone = { GENERATED: "blue", PROCESSED: "green", REJECTED: "red" } as const;

export default async function EdiDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { id } = await params;

  const doc = await db.ediDocument.findUnique({
    where: { id, companyId: session.companyId },
    include: { partner: { select: { id: true, name: true } } },
  });
  if (!doc) notFound();

  const [ack, orders] = await Promise.all([
    doc.acknowledgesId
      ? db.ediDocument.findUnique({
          where: { id: doc.acknowledgesId, companyId: session.companyId },
          select: { id: true, docType: true, status: true, direction: true },
        })
      : null,
    // An inbound 850 file can hold several orders; show them all.
    doc.direction === "INBOUND" && doc.status === "PROCESSED" && doc.partner
      ? db.order.findMany({
          where: {
            companyId: session.companyId,
            customerPoNumber: { in: (doc.reference ?? "").split(", ").filter(Boolean) },
          },
          select: { id: true, customerPoNumber: true, totalAmount: true },
        })
      : [],
  ]);

  const pretty = prettyX12(doc.content);
  const linkClass = "text-blue-400 hover:text-blue-300 light:text-blue-700 light:hover:text-blue-800";

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">
                <span className="font-mono">{doc.docType === "unknown" ? "" : `${doc.docType} `}</span>
                {DOC_TYPE_LABEL[doc.docType] ?? doc.docType}
              </h1>
              <Badge tone={doc.direction === "INBOUND" ? "purple" : "slate"}>{doc.direction === "INBOUND" ? "Received" : "To send"}</Badge>
              <StatusBadge status={doc.status} tone={statusTone[doc.status]} />
            </div>
            <p className="mt-1 text-slate-400 light:text-slate-500">
              {doc.partner ? doc.partner.name : "Unknown sender"} · Control number{" "}
              <span className="font-mono">{String(doc.controlNumber).padStart(9, "0")}</span> · {doc.createdAt.toLocaleString()}
            </p>
          </div>
          <a
            href={`/api/edi/${doc.id}`}
            className={buttonStyles("primary", "md", "self-start")}
          >
            <Download className="h-4 w-4" />
            Download file
          </a>
        </div>

        {doc.error && (
          <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{doc.error}</p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Linked records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-slate-300 light:text-slate-600">
            {orders.map((o) => (
              <p key={o.id}>
                Sales order for PO <span className="font-mono">{o.customerPoNumber}</span>, ${o.totalAmount.toFixed(2)}:{" "}
                <Link href={`/dashboard/sales/${o.id}`} className={linkClass}>
                  open order
                </Link>
              </p>
            ))}
            {doc.purchaseOrderId && (
              <p>
                <Link href={`/dashboard/procurement/${doc.purchaseOrderId}`} className={linkClass}>
                  Purchase order {doc.reference}
                </Link>
              </p>
            )}
            {doc.invoiceId && (
              <p>
                <Link href={`/dashboard/invoicing/${doc.invoiceId}`} className={linkClass}>
                  Invoice {doc.reference}
                </Link>
              </p>
            )}
            {doc.orderId && doc.direction === "OUTBOUND" && (
              <p>
                <Link href={`/dashboard/sales/${doc.orderId}`} className={linkClass}>
                  Sales order
                </Link>
              </p>
            )}
            {ack && (
              <p>
                <Link href={`/dashboard/edi/${ack.id}`} className={linkClass}>
                  {ack.docType === "997" ? "997 acknowledgment sent back" : `Acknowledges a received ${ack.docType}`}
                </Link>
              </p>
            )}
            {orders.length === 0 && !doc.purchaseOrderId && !doc.invoiceId && !doc.orderId && !ack && (
              <p className="text-slate-500">Nothing in the system was created or linked from this file.</p>
            )}
          </CardContent>
        </Card>

        {doc.direction === "OUTBOUND" && (
          <p className="mt-4 text-xs text-slate-500">
            Download this file and send it through your EDI network, VAN or AS2 connection. This app prepares the
            documents but doesn&apos;t transmit them.
          </p>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>File contents</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[32rem] overflow-auto rounded-md bg-black/40 p-4 font-mono text-xs leading-relaxed text-slate-300 light:bg-slate-50 light:text-slate-700">
              {pretty}
            </pre>
          </CardContent>
        </Card>

        <p className="mt-6">
          <Link href="/dashboard/edi" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
            ← Back to EDI
          </Link>
        </p>
      </div>
    </div>
  );
}
