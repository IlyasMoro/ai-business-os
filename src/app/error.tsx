"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui-dark/button";

export default function GlobalError({
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center light:bg-white">
      <p className="text-sm font-semibold text-red-400">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-50 light:text-slate-900">
        Unexpected error
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">
        An unexpected error occurred. You can try again, or come back later.
      </p>
      <div className="mt-6">
        <Button onClick={() => unstable_retry()}>Try again</Button>
      </div>
    </div>
  );
}
