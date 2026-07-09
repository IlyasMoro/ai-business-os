"use client";

import { useRef } from "react";
import { Select } from "@/components/ui-dark/input";
import { updatePurchaseOrderStatus } from "@/lib/actions/procurement";

export function PurchaseOrderStatusForm({
  purchaseOrderId,
  status,
}: {
  purchaseOrderId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updatePurchaseOrderStatus.bind(null, purchaseOrderId);

  return (
    <form ref={formRef} action={action}>
      <Select
        name="status"
        defaultValue={status}
        className="w-auto"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="DRAFT">Draft</option>
        <option value="ORDERED">Ordered</option>
        <option value="RECEIVED">Received</option>
        <option value="CANCELLED">Cancelled</option>
      </Select>
    </form>
  );
}
