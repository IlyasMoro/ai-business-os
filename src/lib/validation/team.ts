import * as z from "zod";

export const InviteRoleValues = ["ADMIN", "EMPLOYEE"] as const;

export const InviteTeamMemberSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim().toLowerCase(),
  // "ADMIN", "EMPLOYEE" or "role:<id>" for one of the company roles.
  role: z.string().refine((v) => (InviteRoleValues as readonly string[]).includes(v) || (v.startsWith("role:") && v.length > 5), { error: "Select a valid role." }),
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
