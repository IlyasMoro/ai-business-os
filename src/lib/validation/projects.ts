import * as z from "zod";

export const ProjectStatusValues = ["ACTIVE", "COMPLETED", "ON_HOLD"] as const;
export const TaskStatusValues = ["TODO", "IN_PROGRESS", "DONE"] as const;

export const ProjectSchema = z.object({
  name: z.string().min(1, { error: "Name is required." }).trim(),
  description: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
});

export type ProjectFormState =
  | {
      errors?: {
        name?: string[];
        description?: string[];
        customerId?: string[];
        dueDate?: string[];
      };
      message?: string;
    }
  | undefined;

export const TaskSchema = z.object({
  title: z.string().min(1, { error: "Title is required." }).trim(),
  description: z.string().trim().optional(),
  assigneeId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
});

export type TaskFormState =
  | {
      errors?: {
        title?: string[];
        description?: string[];
        assigneeId?: string[];
        dueDate?: string[];
      };
      message?: string;
    }
  | undefined;
