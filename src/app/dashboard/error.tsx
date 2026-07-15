"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui-dark/button";

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
    <div className="flex flex-col items-center justify-center rounded-lg border border-white/[0.06] bg-[#111111] px-4 py-16 text-center light:border-slate-200 light:bg-white">
      <p className="text-sm font-semibold text-red-400">Something went wrong</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-50 light:text-slate-900">
        This page couldn&apos;t load
      </h2>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
        An unexpected error occurred loading this page. You can try again.
      </p>
      <div className="mt-6">
        <Button onClick={() => unstable_retry()}>Try again</Button>
      </div>
    </div>
  );
}
