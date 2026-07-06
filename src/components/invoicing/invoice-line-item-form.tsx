"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, FieldError } from "@/components/ui/input";
import { addInvoiceLineItem } from "@/lib/actions/invoicing";
import type { InvoiceLineItemFormState } from "@/lib/validation/invoicing";

export function InvoiceLineItemForm({
  invoiceId,
  products,
}: {
  invoiceId: string;
  products: { id: string; name: string; sku: string; unitPrice: number }[];
}) {
  const action = addInvoiceLineItem.bind(null, invoiceId) as (
    state: InvoiceLineItemFormState,
    formData: FormData
  ) => Promise<InvoiceLineItemFormState>;
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.errors && !state?.message && !pending) {
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      <div className="col-span-2 sm:col-span-2">
        <Input name="description" placeholder="Description" required />
        <FieldError messages={state?.errors?.description} />
      </div>
      <div>
        <Select name="productId" defaultValue="">
          <option value="">No product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.sku})
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.productId} />
      </div>
      <div>
        <Input name="quantity" type="number" min="1" step="1" placeholder="Qty" defaultValue={1} required />
        <FieldError messages={state?.errors?.quantity} />
      </div>
      <div>
        <Input
          name="unitPrice"
          type="number"
          min="0"
          step="0.01"
          placeholder="Unit price"
          required
        />
        <FieldError messages={state?.errors?.unitPrice} />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding..." : "Add item"}
      </Button>
      {state?.message && <p className="col-span-full text-sm text-red-600">{state.message}</p>}
    </form>
  );
}
