import { notFound } from "next/navigation";

/* Any /dashboard address that matches no page shows the in-app 404
   (dashboard/not-found.tsx, inside the menu) instead of the public one. */
export default function MissingDashboardPage() {
  notFound();
}
