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

  // Keep the dropdown in sync with the status that's actually saved: after
  // a successful change status has moved on, after a rejected one (e.g. a
  // failed credit or stock check) it hasn't, either way this is the truth.
  useEffect(() => {
    if (selectRef.current) {
      selectRef.current.value = status;
    }
  }, [status, state]);

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
