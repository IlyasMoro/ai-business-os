import { tagColor } from "@/lib/crm-tags";
import { scoreBand, SCORE_BANDS } from "@/lib/lead-score";
import { cn } from "@/lib/utils";

/** A customer's tags as small coloured chips. */
export function TagChips({ tags, className }: { tags: { id: string; name: string; color: string }[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <span key={tag.id} className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", tagColor(tag.color).chip)}>
          {tag.name}
        </span>
      ))}
    </span>
  );
}

const bandStyles = {
  hot: "border-red-500/40 bg-red-500/10 text-red-300 light:text-red-700",
  warm: "border-amber-500/40 bg-amber-500/10 text-amber-300 light:text-amber-700",
  cool: "border-slate-500/30 bg-slate-500/10 text-slate-400 light:text-slate-600",
} as const;

/** The lead score with its band: "72 Hot". */
export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const band = scoreBand(score);
  return (
    <span
      title={`Lead score ${score} of 100`}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums", bandStyles[band], className)}
    >
      <span className="font-semibold">{score}</span>
      <span>{SCORE_BANDS[band].label}</span>
    </span>
  );
}
