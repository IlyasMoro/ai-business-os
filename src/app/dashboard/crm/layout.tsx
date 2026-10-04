import { verifySession, hasRole } from "@/lib/dal";
import { CrmShell } from "@/components/crm/crm-shell";

/** Keeps the CRM heading and tabs mounted across the CRM's views, so moving
 * between them only swaps the content (components/crm/crm-shell.tsx). */
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  return <CrmShell isAdmin={hasRole(session, ["OWNER", "ADMIN"])}>{children}</CrmShell>;
}
