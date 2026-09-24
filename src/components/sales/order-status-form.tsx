"use client";

import { useActionState, useEffect, useRef } from "react";
import { Select } from "@/components/ui-dark/input";
import { updateOrderStatus } from "@/lib/actions/sales";
import type { OrderStatusFormState } from "@/lib/validation/sales";

export function OrderStatusForm({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const action = updateOrderStatus.bind(null, orderId) as (
    state: OrderStatusFormState,
    formData: FormData
  ) => Promise<OrderStatusFormState>;
  const [state, formAction, pending] = useActionState(action, undefined);

  // The status change (e.g. a failed credit check) was rejected server
  // side, so snap the dropdown back to the status that's actually saved.
  useEffect(() => {
    if (state?.message && selectRef.current) {
      selectRef.current.value = status;
    }
  }, [state, status]);

  return (
    <div className="flex flex-col items-end gap-1">
      <form ref={formRef} action={formAction}>
        <Select
          ref={selectRef}
          name="status"
          defaultValue={status}
          className="w-auto"
          disabled={pending}
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="FULFILLED">Fulfilled</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </form>
      {state?.message && <p className="max-w-xs text-right text-sm text-red-400">{state.message}</p>}
    </div>
  );
}
