import Link from "next/link";
import { db } from "@/lib/db";
import { hasRole, verifySession } from "@/lib/dal";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { getEdiSettings } from "@/lib/edi/settings";
import { generateInvoice810, generatePurchaseOrder850, generateShipNotice856 } from "@/lib/actions/edi";

const KINDS = {
  "850": { flag: "send850", label: "Send EDI 850", recordField: "purchaseOrderId", action: generatePurchaseOrder850 },
  "810": { flag: "send810", label: "Send EDI 810", recordField: "invoiceId", action: generateInvoice810 },
  "856": { flag: "send856", label: "Send EDI 856", recordField: "orderId", action: generateShipNotice856 },
} as const;

/**
 * Shown on a purchase order, invoice or fulfilled sales order when there's
 * a trading partner set up to receive that document. Renders nothing
 * otherwise, so businesses that don't use EDI never see it.
 */
export async function EdiSendButton({
  docType,
  recordId,
  customerId,
  supplierId,
}: {
  docType: keyof typeof KINDS;
  recordId: string;
  customerId?: string;
  supplierId?: string;
}) {
  const session = await verifySession();
  if (!hasRole(session, ["OWNER", "ADMIN"])) return null;
  const settings = await getEdiSettings(session.companyId);
  if (!settings?.enabled) return null;

  const kind = KINDS[docType];
  const [partner, last] = await Promise.all([
    db.ediPartner.findFirst({
      where: { companyId: session.companyId, enabled: true, [kind.flag]: true, ...(customerId ? { customerId } : { supplierId }) },
      select: { name: true },
    }),
    db.ediDocument.findFirst({
      where: { companyId: session.companyId, docType, direction: "OUTBOUND", [kind.recordField]: recordId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
  ]);
  if (!partner) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={kind.action.bind(null, recordId)}>
        <SubmitButton variant="secondary" pendingText="Generating..." className="whitespace-nowrap">
          {last ? `${kind.label} again` : kind.label}
        </SubmitButton>
      </form>
      {last && (
        <Link href={`/dashboard/edi/${last.id}`} className="text-xs text-blue-400 hover:text-blue-300">
          Last sent {last.createdAt.toLocaleDateString()}
        </Link>
      )}
    </div>
  );
}
