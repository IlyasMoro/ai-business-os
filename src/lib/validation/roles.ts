import { z } from "zod";
import { MODULES, cleanAccess, type RoleAccess } from "@/lib/role-access";

export const CompanyRoleSchema = z.object({
  name: z.string().trim().min(2, { error: "Give the role a name." }).max(60, { error: "Keep the name under 60 characters." }),
  description: z.string().trim().max(240, { error: "Keep the description under 240 characters." }).optional(),
  baseRole: z.enum(["ADMIN", "EMPLOYEE"], { error: "Pick the level." }),
});

export type CompanyRoleFormState =
  | {
      errors?: { name?: string[]; description?: string[]; baseRole?: string[]; access?: string[] };
      message?: string;
    }
  | undefined;

/** The module choices from the form: field access_<module> is none, view or full. */
export function accessFromForm(formData: FormData, baseRole: "ADMIN" | "EMPLOYEE"): RoleAccess {
  const raw: Record<string, string> = {};
  for (const m of MODULES) {
    const v = formData.get(`access_${m.key}`);
    if (v === "view" || v === "full") raw[m.key] = v;
  }
  return cleanAccess(raw, baseRole);
}

/** A member's role from a select: "ADMIN", "EMPLOYEE" or "role:<id>". */
export function parseRoleChoice(value: FormDataEntryValue | null): { kind: "base"; role: "ADMIN" | "EMPLOYEE" } | { kind: "company"; id: string } | null {
  if (value === "ADMIN" || value === "EMPLOYEE") return { kind: "base", role: value };
  if (typeof value === "string" && value.startsWith("role:") && value.length > 5) return { kind: "company", id: value.slice(5) };
  return null;
}
