import Link from "next/link";
import { Bot, Check, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export type AuthPoint = { icon: LucideIcon; text: string };

/* The screen every public form sits on (sign in, sign up, password reset,
   invites, contact): the form on white at the left, the dark blue glass
   brand panel with a small picture of the app at the right on wide screens.
   Always light on the left, whatever theme the app is set to. */
export function AuthShell({
  title,
  sub,
  topLink,
  panelEyebrow,
  panelTitle,
  points,
  below,
  wide = false,
  children,
}: {
  /** A wider form column for longer forms (contact). */
  wide?: boolean;
  title: string;
  sub?: React.ReactNode;
  /** Top right: "New to AIBOS? Start free trial" and the like. */
  topLink?: { lead: string; label: string; href: string };
  panelEyebrow: string;
  panelTitle: string;
  points: AuthPoint[];
  /** Small print under the form. */
  below?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-white text-[#0b1f5e] [color-scheme:light] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-screen flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="AIBOS home" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b3fbf]/40">
            <Logo onLight />
          </Link>
          {topLink && (
            <p className="text-sm text-slate-500">
              <span className="hidden sm:inline">{topLink.lead} </span>
              <Link href={topLink.href} className="font-semibold text-[#1b3fbf] hover:text-[#0b1f5e] hover:underline">
                {topLink.label}
              </Link>
            </p>
          )}
        </header>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className={wide ? "w-full max-w-[560px]" : "w-full max-w-[400px]"}>
            <h1 className="font-display text-[2rem] font-bold leading-tight tracking-tight">{title}</h1>
            {sub && <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-500">{sub}</p>}
            <div className="mt-8">{children}</div>
            {below && <div className="mt-8 text-xs leading-relaxed text-slate-400">{below}</div>}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} AIBOS</span>
          <nav className="flex gap-5">
            <Link href="/privacy" className="hover:text-slate-700">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-700">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-slate-700">
              Help
            </Link>
          </nav>
        </footer>
      </div>

      <aside
        className="relative isolate hidden flex-col justify-between overflow-hidden bg-[#050a18] p-12 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:self-start xl:p-16"
        aria-label="About AIBOS"
      >
        <Backdrop />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{panelEyebrow}</p>
          <h2 className="mt-4 max-w-md font-display text-[2.1rem] font-bold leading-[1.15] tracking-tight">{panelTitle}</h2>
        </div>

        <AppPreview />

        {/* Three glass tiles side by side, each with its icon above the text. */}
        <ul className="grid grid-cols-3 gap-3">
          {points.map((p) => (
            <li
              key={p.text}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-snug text-white/80 backdrop-blur-xl"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-300 ring-1 ring-cyan-300/20" aria-hidden>
                <p.icon className="h-[1.1rem] w-[1.1rem]" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/* Deep blue with two soft glows: the panel's glass background. */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,#1b3fbf_0%,transparent_55%),radial-gradient(ellipse_at_bottom_left,#0b3a5c_0%,transparent_55%)]" />
      <div className="absolute -right-24 top-0 h-[26rem] w-[26rem] rounded-full bg-blue-600/25 blur-[120px]" />
      <div className="absolute -left-24 bottom-0 h-[22rem] w-[22rem] rounded-full bg-cyan-400/15 blur-[120px]" />
    </div>
  );
}

/* A small, made up glimpse of the dashboard: two tiles, a trend line and a
   Copilot suggestion waiting for approval. Decorative only. */
function AppPreview() {
  return (
    <div className="relative mb-24 mt-8 max-w-lg" aria-hidden>
      <div className="rounded-2xl border border-white/10 bg-[#0b1430]/60 p-5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-3">
          <PreviewTile label="Revenue this month" value="R 1,108,240" change="+6%" />
          <PreviewTile label="Invoices paid" value="23 of 36" change="64%" />
        </div>
        <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Sales, last 6 months</span>
            <span className="text-emerald-300">Trending up</span>
          </div>
          <svg viewBox="0 0 300 70" className="mt-3 h-16 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="auth-trend" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#22d3ee" stopOpacity="0.35" />
                <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 52 L50 46 L100 50 L150 34 L200 38 L250 20 L300 12 L300 70 L0 70 Z" fill="url(#auth-trend)" />
            <path d="M0 52 L50 46 L100 50 L150 34 L200 38 L250 20 L300 12" fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>

      <div className="absolute -bottom-[5.5rem] -right-4 w-72 rounded-xl border border-white/10 bg-[#101c3d]/90 p-4 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.9)] backdrop-blur-xl xl:-right-10">
        <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
          <Bot className="h-3.5 w-3.5" />
          AI Copilot
        </div>
        <p className="mt-2 text-sm leading-snug text-white/85">3 invoices are overdue. Send a friendly reminder to each customer?</p>
        <div className="mt-3 flex gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-400 px-2.5 py-1 text-xs font-semibold text-[#0a1428]">
            <Check className="h-3 w-3" />
            Approve
          </span>
          <span className="rounded-md bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-white/70">Not now</span>
        </div>
      </div>
    </div>
  );
}

function PreviewTile({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1.5 font-display text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold text-emerald-300">{change}</p>
    </div>
  );
}
