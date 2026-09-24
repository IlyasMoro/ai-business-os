"use client";

import { useEffect, useRef } from "react";
import { Select } from "@/components/ui-dark/input";
import { updateProjectStatus } from "@/lib/actions/projects";

export function ProjectStatusForm({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const action = updateProjectStatus.bind(null, projectId);

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
        <option value="ACTIVE">Active</option>
        <option value="COMPLETED">Completed</option>
        <option value="ON_HOLD">On hold</option>
      </Select>
    </form>
  );
}
