"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BarChart3,
  Boxes,
  FolderKanban,
  Plug,
  SlidersHorizontal,
  Sparkles,
  UserSquare2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* The AIBOS mark, told as a story: each of the eight outer dots is one of
   the menu's department groups, and the center dot is the AI Copilot they
   all feed. Mirrors navGroups in components/layout/nav-config.ts. */

type Node = {
  name: string;
  tagline: string;
  modules: string[];
  icon: LucideIcon;
  color: string;
};

const CORE: Node = {
  name: "AI Copilot",
  tagline: "Reads every department, answers in plain language, and always asks before it acts.",
  modules: ["Dashboard", "AI Copilot", "Calendar"],
  icon: Sparkles,
  color: "#67e8f9",
};

const DEPARTMENTS: Node[] = [
  { name: "Customers and Sales", tagline: "Win customers, take orders and get paid.", modules: ["CRM", "Marketing", "Sales", "Returns", "Invoicing", "Support"], icon: Users, color: "#60a5fa" },
  { name: "Operations", tagline: "Keep stock moving from supplier to shelf.", modules: ["Inventory", "Procurement", "Planning / MRP"], icon: Boxes, color: "#fbbf24" },
  { name: "Finance", tagline: "Every transaction and cost, reconciled as it happens.", modules: ["Accounting", "Controlling"], icon: Wallet, color: "#34d399" },
  { name: "People", tagline: "Hire, pay and organize your team.", modules: ["HR", "Payroll", "Team"], icon: UserSquare2, color: "#f472b6" },
  { name: "Work Management", tagline: "Plan projects and automate the busywork.", modules: ["Projects", "Automation"], icon: FolderKanban, color: "#a78bfa" },
  { name: "Insights", tagline: "The whole business in one report, with an AI summary.", modules: ["Reports"], icon: BarChart3, color: "#22d3ee" },
  { name: "Connectivity", tagline: "Connect the tools and trading partners you already use.", modules: ["Integrations", "EDI"], icon: Plug, color: "#fb923c" },
  { name: "Administration", tagline: "Control access, billing and settings in one place.", modules: ["Billing", "Settings"], icon: SlidersHorizontal, color: "#94a3b8" },
];

// Index 0 is the core; 1 to 8 are the departments, clockwise from the top.
const NODES = [CORE, ...DEPARTMENTS];

const SIZE = 400;
const C = SIZE / 2;
const R = 146;

function position(i: number) {
  const angle = ((i * 45 - 90) * Math.PI) / 180;
  return { x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) };
}

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function ModuleConstellation() {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true
  );
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lastPick, setLastPick] = useState(0);

  // Tour the departments on its own until the visitor takes over.
  useEffect(() => {
    if (reducedMotion || paused) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % NODES.length), 3200);
    return () => window.clearInterval(id);
  }, [reducedMotion, paused]);

  // Resume the tour a while after the last pick. Touch screens never fire
  // a mouse leave, so without this one tap would stop it for good.
  useEffect(() => {
    if (!paused) return;
    const id = window.setTimeout(() => setPaused(false), 8000);
    return () => window.clearTimeout(id);
  }, [paused, lastPick]);

  const current = NODES[active];

  const select = (i: number) => {
    setActive(i);
    setPaused(true);
    setLastPick((n) => n + 1);
  };

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-12">
      <div className="relative mx-auto aspect-square w-full max-w-[30rem]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <radialGradient id="aibos-core-glow">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={C} cy={C} r={70} fill="url(#aibos-core-glow)" />
          <circle cx={C} cy={C} r={R} fill="none" stroke="rgb(96 165 250 / 0.28)" strokeWidth="1.5" />

          {DEPARTMENTS.map((dept, n) => {
            const i = n + 1;
            const { x, y } = position(n);
            const isActive = active === i || active === 0;
            const path = `M ${x} ${y} L ${C} ${C}`;
            return (
              <g key={dept.name}>
                <line
                  x1={x}
                  y1={y}
                  x2={C}
                  y2={C}
                  stroke={active === i ? dept.color : "rgb(96 165 250 / 0.28)"}
                  strokeWidth={active === i ? 2.5 : 1.5}
                  style={{ transition: "stroke 300ms ease, stroke-width 300ms ease" }}
                />
                {!reducedMotion && (
                  <circle r={active === i ? 4 : 3} fill={dept.color} opacity={isActive ? 1 : 0.55}>
                    <animateMotion
                      dur={active === i ? "1.1s" : "2.6s"}
                      begin={`${n * 0.33}s`}
                      repeatCount="indefinite"
                      path={path}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes are real buttons laid over the drawing, so they can be
            tabbed to and read by screen readers. */}
        {NODES.map((node, i) => {
          const isCore = i === 0;
          const { x, y } = isCore ? { x: C, y: C } : position(i - 1);
          const isActive = active === i;
          const Icon = node.icon;
          return (
            <button
              key={node.name}
              type="button"
              onClick={() => select(i)}
              onMouseEnter={() => select(i)}
              onFocus={() => select(i)}
              aria-pressed={isActive}
              aria-label={`${node.name}: ${node.modules.join(", ")}`}
              className="group absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none"
              style={{ left: `${(x / SIZE) * 100}%`, top: `${(y / SIZE) * 100}%` }}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300 group-focus-visible:ring-2 group-focus-visible:ring-white/70",
                  isCore ? "h-16 w-16 sm:h-20 sm:w-20" : "h-11 w-11 sm:h-14 sm:w-14",
                  isActive ? "scale-110" : "scale-100 group-hover:scale-105"
                )}
                style={{
                  borderColor: isActive ? node.color : "rgb(255 255 255 / 0.14)",
                  backgroundColor: isActive ? `${node.color}26` : "rgb(10 14 24 / 0.7)",
                  boxShadow: isActive ? `0 0 28px -4px ${node.color}` : "none",
                  color: isActive || isCore ? node.color : "rgb(226 232 240)",
                }}
              >
                <Icon className={isCore ? "h-7 w-7 sm:h-8 sm:w-8" : "h-5 w-5 sm:h-6 sm:w-6"} />
              </span>
              {!isCore && (
                <span
                  className={cn(
                    "pointer-events-none absolute left-1/2 top-full mt-1.5 hidden -translate-x-1/2 whitespace-nowrap text-xs font-medium transition-colors sm:block",
                    isActive ? "text-white" : "text-slate-400"
                  )}
                >
                  {node.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Editorial text straight on the glass panel: eyebrow and counter,
          a capital title in the landing heading style, an accent rule in the
          node's colour, then its modules as one quiet line. */}
      <div className="flex min-h-[17rem] flex-col sm:min-h-[19rem]">
        <div key={current.name} className="animate-fade-up">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-cyan-400">
              {active === 0 ? "At the center" : "Department"}
            </p>
            <p className="text-xs tabular-nums text-white/60">
              <b className="font-extrabold text-white">{String(active + 1).padStart(2, "0")}</b> /{" "}
              {String(NODES.length).padStart(2, "0")}
            </p>
          </div>
          <h3 className="font-display mt-3 text-3xl font-extrabold uppercase leading-[1.05] text-white sm:text-[2.1rem]">
            {current.name}
          </h3>
          <span aria-hidden className="mt-4 block h-1 w-11 rounded-full" style={{ backgroundColor: current.color }} />
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">{current.tagline}</p>
          {/* The core's own name is one of its modules; listing it again
              under the title would repeat it. */}
          <p className="mt-5 text-sm font-semibold tracking-wide text-white/85">
            {current.modules.filter((m) => m !== current.name).join("  ·  ")}
          </p>
        </div>

        {/* Progress through the tour; each dash also jumps to its point. */}
        <div className="mt-auto flex gap-1.5 pt-8">
          {NODES.map((node, i) => (
            <button
              key={node.name}
              type="button"
              aria-label={`Show ${node.name}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => select(i)}
              className="group flex-1 py-2 focus-visible:outline-none"
            >
              <span
                className={cn(
                  "block h-[3px] rounded-full transition-colors duration-300 group-focus-visible:ring-2 group-focus-visible:ring-cyan-400",
                  i === active ? "bg-cyan-400" : "bg-white/15 group-hover:bg-white/35"
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
