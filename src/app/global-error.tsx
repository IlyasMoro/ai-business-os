"use client";

import { useEffect } from "react";

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
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-center text-white">
        <p className="text-sm font-semibold text-red-400">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">Unexpected error</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-400">
          An unexpected error occurred. You can try again, or come back later.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="mt-6 rounded-md border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
