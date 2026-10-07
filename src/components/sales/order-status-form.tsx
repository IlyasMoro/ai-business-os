"use client";

import { useActionState, useEffect, useRef } from "react";
import { Select } from "@/components/ui-dark/input";
import { updateOrderStatus } from "@/lib/actions/sales";
import type { OrderStatusFormState } from "@/lib/validation/sales";
import { ORDER_STATUS_LABEL, nextStatuses, type OrderStatus } from "@/lib/order-rules";

export function OrderStatusForm({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
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
          onChange={(e) => {
            // Cancelling a shipped order moves stock, so ask first.
            if (
              status === "FULFILLED" &&
              e.currentTarget.value === "CANCELLED" &&
              !window.confirm("Cancel this fulfilled order? Everything it shipped goes back into stock.")
            ) {
              e.currentTarget.value = status;
              return;
            }
            formRef.current?.requestSubmit();
          }}
        >
          {/* Only the steps the order can take from here (lib/order-rules.ts). */}
          <option value={status}>{ORDER_STATUS_LABEL[status]}</option>
          {nextStatuses(status).map((next) => (
            <option key={next} value={next}>
              {status === "CONFIRMED" && next === "PENDING"
                ? "Back to pending"
                : status === "CANCELLED" && next === "PENDING"
                  ? "Reopen as pending"
                  : status === "FULFILLED" && next === "CANCELLED"
                    ? "Cancel, stock goes back"
                    : ORDER_STATUS_LABEL[next]}
            </option>
          ))}
        </Select>
      </form>
      {state?.message && <p className="max-w-xs text-right text-sm text-red-400 light:text-red-700">{state.message}</p>}
    </div>
  );
}
