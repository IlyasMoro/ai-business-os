import { LinkButton } from "@/components/ui-dark/button";

/* A record or page inside the app that doesn't exist (a deleted invoice, an
   old link). Renders inside the dashboard layout, so the menu stays. The
   public 404 for unknown site addresses is app/not-found.tsx. */
export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-blue-400 light:text-blue-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-50 light:text-slate-900">Not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
        This page or record doesn&apos;t exist, was deleted, or belongs to a branch you can&apos;t see.
      </p>
      <div className="mt-6">
        <LinkButton href="/dashboard">Back to dashboard</LinkButton>
      </div>
    </div>
  );
}
