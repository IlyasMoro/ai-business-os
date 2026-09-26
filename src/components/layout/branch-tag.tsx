import { MapPin } from "lucide-react";
import { getBranchContext } from "@/lib/branches";

/**
 * Which branch a record belongs to, shown beside its status in page
 * headers. Hidden for single branch companies, where it would only add noise.
 */
export async function BranchTag({ name }: { name: string | null | undefined }) {
  const { branches } = await getBranchContext();
  if (!name || branches.filter((b) => b.active).length < 2) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.09] px-2 py-0.5 text-xs font-medium text-slate-300 light:border-slate-300 light:text-slate-600">
      <MapPin className="h-3 w-3 text-blue-400 light:text-blue-600" />
      {name}
    </span>
  );
}
