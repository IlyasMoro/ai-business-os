"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function DeleteButton({
  action,
  confirmMessage = "Are you sure? This cannot be undone.",
  label,
  className,
}: {
  action: () => Promise<void>;
  confirmMessage?: string;
  label?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-red-400 transition-colors duration-150 hover:bg-red-500/10 active:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 light:text-red-700",
          className
        )}
      >
        <Trash2 className="h-4 w-4" />
        {label ?? "Delete"}
      </button>
    </form>
  );
}
