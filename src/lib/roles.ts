import type { SessionPayload } from "@/lib/session";

export function hasRole(
  session: Pick<SessionPayload, "role">,
  allowed: SessionPayload["role"][]
) {
  return allowed.includes(session.role);
}
