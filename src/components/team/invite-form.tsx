"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, Select, FieldError } from "@/components/ui-dark/input";
import { inviteTeamMember } from "@/lib/actions/team";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteTeamMember, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="teammate@company.com" required className="w-64" />
        <FieldError messages={state?.errors?.email} />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="role" defaultValue="EMPLOYEE" className="w-36">
          <option value="ADMIN">Admin</option>
          <option value="EMPLOYEE">Employee</option>
        </Select>
        <FieldError messages={state?.errors?.role} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Send invite"}
      </Button>

      {state?.message && (
        <p
          className={
            state.message.startsWith("Invite sent")
              ? "w-full text-sm text-emerald-400"
              : "w-full text-sm text-red-400"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
