import "server-only";

/** Whether this user is the platform operator (you) — distinct from any
 * company's OWNER role. Gated by an env var rather than a database role so
 * it can't be granted or escalated by anything happening inside the app
 * itself (e.g. a new company's OWNER signing up), only by whoever controls
 * the deployment's environment variables. */
export function isPlatformAdmin(email: string): boolean {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  if (!adminEmail) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}
