"use client";

import { useRef } from "react";
import { Select } from "@/components/ui/input";
import { updateTaskStatus } from "@/lib/actions/projects";

export function TaskStatusForm({
  projectId,
  taskId,
  status,
}: {
  projectId: string;
  taskId: string;
  status: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateTaskStatus.bind(null, projectId, taskId);

  return (
    <form ref={formRef} action={action}>
      <Select
        name="status"
        defaultValue={status}
        className="w-auto"
        onChange={() => formRef.current?.requestSubmit()}
      >
        <option value="TODO">To do</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="DONE">Done</option>
      </Select>
    </form>
  );
}
