"use client";

import { useEffect, useRef } from "react";
import { Select } from "@/components/ui-dark/input";
import { updateInvoiceStatus } from "@/lib/actions/invoicing";
import { INVOICE_STATUS_LABEL, nextInvoiceStatuses, type InvoiceStatus } from "@/lib/invoice-rules";

export function InvoiceStatusForm({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const action = updateInvoiceStatus.bind(null, invoiceId);

  // Uncontrolled select: defaultValue only applies at mount, so after a
  // same-session status change it would keep showing the old value until a
  // full page reload. Keep it in sync with the true saved status instead.
  useEffect(() => {
    if (selectRef.current) {
      selectRef.current.value = status;
    }
  }, [status]);

  return (
    <form ref={formRef} action={action}>
      <Select
        ref={selectRef}
        name="status"
        defaultValue={status}
        className="w-auto"
        onChange={() => formRef.current?.requestSubmit()}
      >
        {/* Only the steps allowed from here (lib/invoice-rules.ts). */}
        <option value={status}>{INVOICE_STATUS_LABEL[status]}</option>
        {nextInvoiceStatuses(status).map((next) => (
          <option key={next} value={next}>
            {next === "PAID" ? "Mark paid" : next === "DRAFT" ? "Back to draft" : INVOICE_STATUS_LABEL[next]}
          </option>
        ))}
      </Select>
    </form>
  );
}
