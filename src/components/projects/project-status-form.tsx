"use client";

import { useRef } from "react";
import { Select } from "@/components/ui/input";
import { updateProjectStatus } from "@/lib/actions/projects";

export function ProjectStatusForm({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateProjectStatus.bind(null, projectId);

  return (
    <form ref={formRef} action={action}>
      <Select
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
