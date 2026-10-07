"use client";

import { formatCurrency } from "@/lib/utils";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui-dark/button";
import { FieldError, Input, Select } from "@/components/ui-dark/input";
import { addQuoteItem, type QuoteItemFormState } from "@/lib/actions/quotes";

/** Adds a product line to a quote, or (with `action`) to a deal. The price
 * starts as the product's own and can be typed over, e.g. for a discount. */
export function QuoteItemForm({
  quoteId,
  action,
  products,
}: {
  quoteId?: string;
  action?: (state: QuoteItemFormState, formData: FormData) => Promise<QuoteItemFormState>;
  products: { id: string; name: string; sku: string; unitPrice: number }[];
}) {
  const [state, formAction, pending] = useActionState<QuoteItemFormState, FormData>(
    action ?? addQuoteItem.bind(null, quoteId ?? ""),
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state?.errors && !state?.message && !pending) formRef.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      <div className="col-span-2 sm:col-span-3">
        <Select
          name="productId"
          aria-label="Product"
          defaultValue=""
          required
          onChange={(e) => {
            const product = products.find((p) => p.id === e.target.value);
            if (product && priceRef.current) priceRef.current.value = product.unitPrice.toFixed(2);
          }}
        >
          <option value="" disabled>
            Select a product
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku}), {formatCurrency(p.unitPrice)}
            </option>
          ))}
        </Select>
        <FieldError messages={state?.errors?.productId} />
      </div>
      <div>
        <Input name="quantity" aria-label="Quantity" type="number" min="0.001" step="any" defaultValue={1} required />
        <FieldError messages={state?.errors?.quantity} />
      </div>
      <div>
        <Input ref={priceRef} name="unitPrice" aria-label="Unit price" type="number" min="0" step="0.01" placeholder="Price" />
        <FieldError messages={state?.errors?.unitPrice} />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding..." : "Add line"}
      </Button>
      {state?.message && <p className="col-span-full text-sm text-red-400 light:text-red-700">{state.message}</p>}
    </form>
  );
}
