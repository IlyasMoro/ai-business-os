"use client";

import { useState } from "react";
import { Input } from "@/components/ui-dark/input";
import { Button } from "@/components/ui-dark/button";
import { useFormStatus } from "react-dom";

function DeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={disabled || pending}>
      {pending ? "Deleting..." : "Delete company permanently"}
    </Button>
  );
}

export function DeleteCompanyForm({
  companyName,
  action,
}: {
  companyName: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState("");

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-slate-400">
        Type <span className="font-medium text-slate-200">{companyName}</span> to confirm
        permanent deletion of this company and all of its data.
      </p>
      <Input
        name="confirmCompanyName"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder={companyName}
        autoComplete="off"
      />
      <DeleteButton disabled={confirmation !== companyName} />
    </form>
  );
}
