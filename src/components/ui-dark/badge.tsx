import { cn } from "@/lib/utils";

type Tone = "slate" | "green" | "yellow" | "red" | "blue" | "purple";

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
