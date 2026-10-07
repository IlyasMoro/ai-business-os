import { notFound } from "next/navigation";

export const metadata = { title: "Page not found" };

/* Any /dashboard address that matches no page shows the in-app 404
   (dashboard/not-found.tsx, inside the menu) instead of the public one. */
export default function MissingDashboardPage() {
  notFound();
}
