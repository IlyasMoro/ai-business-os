"use client";

import { useRef } from "react";
import { Select } from "@/components/ui/input";
import { updateInvoiceStatus } from "@/lib/actions/invoicing";

export function InvoiceStatusForm({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateInvoiceStatus.bind(null, invoiceId);

  return (
    <form ref={formRef} action={action}>
      <Select
        name="status"
        defaultValue={status}
        className="w-auto"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="DRAFT">Draft</option>
        <option value="SENT">Sent</option>
        <option value="PAID">Paid</option>
        <option value="OVERDUE">Overdue</option>
      </Select>
    </form>
  );
}
