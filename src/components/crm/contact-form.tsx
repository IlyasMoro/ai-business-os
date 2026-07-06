"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input, FieldError } from "@/components/ui/input";
import { createContact } from "@/lib/actions/crm";
import type { ContactFormState } from "@/lib/validation/crm";

export function ContactForm({ customerId }: { customerId: string }) {
  const action = createContact.bind(null, customerId) as (
    state: ContactFormState,
    formData: FormData
  ) => Promise<ContactFormState>;
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.errors && !state?.message && !pending) {
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="col-span-2 sm:col-span-1">
        <Input name="name" placeholder="Name" required />
        <FieldError messages={state?.errors?.name} />
      </div>
      <div>
        <Input name="role" placeholder="Role" />
      </div>
      <div>
        <Input name="email" type="email" placeholder="Email" />
        <FieldError messages={state?.errors?.email} />
      </div>
      <div>
        <Input name="phone" placeholder="Phone" />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding..." : "Add contact"}
      </Button>
    </form>
  );
}
