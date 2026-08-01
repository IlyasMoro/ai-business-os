import * as z from "zod";

export const InviteRoleValues = ["ADMIN", "EMPLOYEE"] as const;

export const InviteTeamMemberSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim().toLowerCase(),
  role: z.enum(InviteRoleValues, { error: "Select a valid role." }),
});

export type InviteTeamMemberFormState =
  | {
      errors?: {
        email?: string[];
        role?: string[];
      };
      message?: string;
    }
  | undefined;

export const AcceptInviteSchema = z.object({
  name: z.string().min(2, { error: "Your name must be at least 2 characters." }).trim(),
  password: z.string().min(8, { error: "Password must be at least 8 characters." }),
});

export type AcceptInviteFormState =
  | {
      errors?: {
        name?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
