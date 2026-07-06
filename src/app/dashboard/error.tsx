"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-surface px-4 py-16 text-center">
      <p className="text-sm font-semibold text-red-600">Something went wrong</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">
        This page couldn&apos;t load
      </h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        An unexpected error occurred loading this page. You can try again.
      </p>
      <div className="mt-6">
        <Button onClick={() => unstable_retry()}>Try again</Button>
      </div>
    </div>
  );
}
