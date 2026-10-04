import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The AI Copilot's mark: the bright centre point of the AIBOS logo with the
 * eight spokes that join it to the departments. Drawn as SVG so it stays
 * sharp at any size; size it with className (h-4 w-4, h-6 w-6, ...).
 */
export function CopilotMark({ className }: { className?: string }) {
  // A unique gradient id, so several marks on one page don't share one.
  const id = useId();
  const spokes = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("shrink-0", className)}>
      <defs>
        <radialGradient id={`${id}-core`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="55%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
      </defs>
      {spokes.map((angle) => {
        const x1 = 12 + Math.cos(angle) * 6.6;
        const y1 = 12 + Math.sin(angle) * 6.6;
        const x2 = 12 + Math.cos(angle) * 10;
        const y2 = 12 + Math.sin(angle) * 10;
        return (
          <g key={angle}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx={x2} cy={y2} r="1.35" fill="#2563eb" />
          </g>
        );
      })}
      <circle cx="12" cy="12" r="5.4" fill={`url(#${id}-core)`} stroke="#1d4ed8" strokeWidth="1" />
    </svg>
  );
}
