"use client";

import { useRef } from "react";
import { Select } from "@/components/ui/input";
import { updateTicketStatus } from "@/lib/actions/support";

export function TicketStatusForm({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateTicketStatus.bind(null, ticketId);

  return (
    <form ref={formRef} action={action}>
      <Select
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
