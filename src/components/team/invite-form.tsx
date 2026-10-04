"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui-dark/button";
import { Input, Label, Select, FieldError } from "@/components/ui-dark/input";
import { inviteTeamMember } from "@/lib/actions/team";

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteTeamMember, undefined);

  return (
    // A row (email, role, send) when the card is wide, stacked in the narrow
    // side column on extra wide screens.
    <form action={formAction} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-start 2xl:grid-cols-1">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="teammate@company.com" required className="w-full" />
        <FieldError messages={state?.errors?.email} />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="role" defaultValue="EMPLOYEE" className="w-full">
          <option value="ADMIN">Admin</option>
          <option value="EMPLOYEE">Employee</option>
        </Select>
        <FieldError messages={state?.errors?.role} />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:mt-6 2xl:mt-0">
        {pending ? "Sending..." : "Send invite"}
      </Button>

      {state?.message && (
        <p
          className={
            state.message.startsWith("Invite sent")
              ? "text-sm text-emerald-400 sm:col-span-3 2xl:col-span-1"
              : "text-sm text-red-400 sm:col-span-3 2xl:col-span-1"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
