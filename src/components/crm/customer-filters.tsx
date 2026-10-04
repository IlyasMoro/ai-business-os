"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fieldStyles } from "@/components/ui-dark/input";

/** Tag and sort dropdowns for the customer list; each change reloads the
 * list with the choice in the address, back to page one. */
export function CustomerFilters({ tags }: { tags: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.length > 0 && (
        <select
          aria-label="Filter by tag"
          value={params.get("tag") ?? ""}
          onChange={(e) => set("tag", e.target.value)}
          className={fieldStyles("w-auto py-1.5 pr-8")}
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Sort customers"
        value={params.get("sort") ?? ""}
        onChange={(e) => set("sort", e.target.value)}
        className={fieldStyles("w-auto py-1.5 pr-8")}
      >
        <option value="">Newest first</option>
        <option value="score">Hottest leads first</option>
        <option value="name">Name A to Z</option>
      </select>
    </div>
  );
}
