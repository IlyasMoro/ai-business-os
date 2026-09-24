"use client";

import { useEffect, useRef } from "react";
import { Select } from "@/components/ui-dark/input";
import { updateTicketStatus } from "@/lib/actions/support";

export function TicketStatusForm({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const action = updateTicketStatus.bind(null, ticketId);

  // Uncontrolled select: defaultValue only applies at mount, so after a
  // same-session status change it would keep showing the old value until a
  // full page reload. Keep it in sync with the true saved status instead.
  useEffect(() => {
    if (selectRef.current) {
      selectRef.current.value = status;
    }
  }, [status]);

  return (
    <form ref={formRef} action={action}>
      <Select
        ref={selectRef}
        name="status"
        defaultValue={status}
        className="w-auto"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="RESOLVED">Resolved</option>
        <option value="CLOSED">Closed</option>
      </Select>
    </form>
  );
}
