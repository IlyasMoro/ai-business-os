import { cn } from "@/lib/utils";
import { toneForVizColor } from "@/components/dash-viz/colors";

export type Tone = "slate" | "green" | "yellow" | "red" | "blue" | "purple";

const toneClasses: Record<Tone, string> = {
  slate: "border-slate-700 bg-slate-800/60 text-slate-300 light:border-slate-300 light:bg-slate-100 light:text-slate-700",
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 light:text-emerald-700",
  yellow: "border-amber-500/40 bg-amber-500/10 text-amber-400 light:text-amber-700",
  red: "border-red-500/40 bg-red-500/10 text-red-400 light:text-red-700",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-400 light:text-blue-700",
  purple: "border-purple-500/40 bg-purple-500/10 text-purple-400 light:text-purple-700",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Status pill for list and detail pages. Takes either a Badge tone or the same VIZ color the page already
 * uses for its status chart, so the table and the chart can never disagree,
 * and turns raw enum values like IN_PROGRESS into readable labels.
 */
export function StatusBadge({
  status,
  color,
  tone,
  className,
}: {
  status: string;
  color?: string;
  tone?: Tone;
  className?: string;
}) {
  const label = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <Badge tone={tone ?? (color ? toneForVizColor(color) : "slate")} className={cn("gap-1.5", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}
