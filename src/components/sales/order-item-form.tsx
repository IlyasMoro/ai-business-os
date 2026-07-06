"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, FieldError } from "@/components/ui/input";
import { addOrderItem } from "@/lib/actions/sales";
import type { OrderItemFormState } from "@/lib/validation/sales";

export function OrderItemForm({
  orderId,
  products,
}: {
  orderId: string;
  products: { id: string; name: string; sku: string; unitPrice: number }[];
}) {
  const action = addOrderItem.bind(null, orderId) as (
    state: OrderItemFormState,
    formData: FormData
  ) => Promise<OrderItemFormState>;
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.errors && !state?.message && !pending) {
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2">
        <Select name="productId" defaultValue="" required>
          <option value="" disabled>
            Select a product
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.sku}) — ${product.unitPrice.toFixed(2)}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.productId} />
      </div>
      <div>
        <Input name="quantity" type="number" min="1" step="1" placeholder="Qty" defaultValue={1} required />
        <FieldError messages={state?.errors?.quantity} />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding..." : "Add item"}
      </Button>
      {state?.message && <p className="col-span-full text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
