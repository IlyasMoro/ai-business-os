import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  basePath,
  query,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value) params.set(key, value);
    }
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const navClass =
    "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150";

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={cn(navClass, "text-slate-600 hover:bg-slate-100")}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        ) : (
          <span className={cn(navClass, "text-slate-300")}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </span>
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={cn(navClass, "text-slate-600 hover:bg-slate-100")}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(navClass, "text-slate-300")}>
            Next
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
