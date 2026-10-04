"use client";

import { useEffect, useRef } from "react";
import { Select } from "@/components/ui-dark/input";
import { updatePurchaseOrderStatus } from "@/lib/actions/procurement";
import { PO_STATUS_LABEL, nextPoStatuses, type PurchaseOrderStatus } from "@/lib/po-rules";

export function PurchaseOrderStatusForm({
  purchaseOrderId,
  status,
}: {
  purchaseOrderId: string;
  status: PurchaseOrderStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const action = updatePurchaseOrderStatus.bind(null, purchaseOrderId);

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
        {/* Only the steps allowed from here (lib/po-rules.ts). */}
        <option value={status}>{PO_STATUS_LABEL[status]}</option>
        {nextPoStatuses(status).map((next) => (
          <option key={next} value={next}>
            {status === "ORDERED" && next === "DRAFT"
              ? "Back to draft"
              : status === "CANCELLED" && next === "DRAFT"
                ? "Reopen as draft"
                : next === "RECEIVED"
                  ? "Received, add to stock"
                  : PO_STATUS_LABEL[next]}
          </option>
        ))}
      </Select>
    </form>
  );
}
