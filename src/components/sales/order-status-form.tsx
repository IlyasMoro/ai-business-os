"use client";

import { useRef } from "react";
import { Select } from "@/components/ui/input";
import { updateOrderStatus } from "@/lib/actions/sales";

export function OrderStatusForm({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateOrderStatus.bind(null, orderId);

  return (
    <form ref={formRef} action={action}>
      <Select
        name="status"
        defaultValue={status}
        className="w-auto"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="PENDING">Pending</option>
        <option value="CONFIRMED">Confirmed</option>
        <option value="FULFILLED">Fulfilled</option>
        <option value="CANCELLED">Cancelled</option>
      </Select>
    </form>
  );
}
