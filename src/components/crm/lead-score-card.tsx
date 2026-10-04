import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-dark/card";
import { scoreBand, SCORE_BANDS, type ScoreReason } from "@/lib/lead-score";
import { cn } from "@/lib/utils";

const barColor = { hot: "bg-red-500", warm: "bg-amber-500", cool: "bg-slate-500" } as const;
const textColor = { hot: "text-red-300 light:text-red-600", warm: "text-amber-300 light:text-amber-600", cool: "text-slate-300 light:text-slate-600" } as const;

/** The customer's lead score, how warm that is, and every reason behind it. */
export function LeadScoreCard({ score, reasons }: { score: number; reasons: ScoreReason[] }) {
  const band = scoreBand(score);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-slate-50 light:text-slate-900">{score}</span>
          <span className="text-sm text-slate-500">of 100</span>
          <span className={cn("ml-auto text-sm font-semibold", textColor[band])}>{SCORE_BANDS[band].label}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08] light:bg-slate-200" aria-hidden>
          <div className={cn("h-full rounded-full", barColor[band])} style={{ width: `${score}%` }} />
        </div>
        {reasons.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nothing yet. Log a call, add a deal or send a quote and the score goes up.</p>
        ) : (
          <ul className="mt-4 space-y-1.5 text-sm">
            {reasons.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3">
                <span className="text-slate-300 light:text-slate-600">{r.label}</span>
                <span className={cn("tabular-nums font-medium", r.points > 0 ? "text-emerald-400 light:text-emerald-600" : "text-red-400 light:text-red-600")}>
                  {r.points > 0 ? `+${r.points}` : r.points}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-500">70 and up is hot, 40 to 69 warm. Recent contact counts most, so a quiet customer cools down over time.</p>
      </CardContent>
    </Card>
  );
}
