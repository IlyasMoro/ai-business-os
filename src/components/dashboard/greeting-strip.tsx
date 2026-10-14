import Link from "next/link";
import type { ComponentType } from "react";
import { CheckCircle2 } from "lucide-react";
import { APP_TIME_ZONE, formatCurrency } from "@/lib/utils";

export type AttentionItem = {
  label: string;
  count: number;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** red for money or stock at risk, amber for things waiting on someone. */
  tone: "red" | "amber";
};

const TONE = {
  red: "border-red-400/25 bg-red-500/10 text-red-200 hover:bg-red-500/15 light:border-red-200 light:bg-red-50 light:text-red-700",
  amber:
    "border-amber-400/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15 light:border-amber-200 light:bg-amber-50 light:text-amber-800",
};

function greetingFor(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: APP_TIME_ZONE }).format(now)
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The top of the dashboard: who you are, today's takings, and the few
 * things that need someone today, each a link to the list behind it.
 * Items with a count of zero drop out; with none left it says so.
 */
export function GreetingStrip({
  firstName,
  todaySales,
  todayOrders,
  attention,
}: {
  firstName: string;
  todaySales: number | null;
  todayOrders: number | null;
  attention: AttentionItem[];
}) {
  const now = new Date();
  const dateLine = now.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  });
  const open = attention.filter((a) => a.count > 0);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-400/20 p-5 glass sm:p-6 light:border-cyan-200">
      {/* Soft brand glow behind the greeting. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent"
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300 light:text-cyan-700">{dateLine}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl light:text-slate-900">
            {greetingFor(now)}, {firstName}
          </h1>
          {todaySales !== null && (
            <p className="mt-1.5 text-sm text-slate-300 sm:whitespace-nowrap light:text-slate-600">
              Today so far:{" "}
              <span className="font-semibold text-white light:text-slate-900">{formatCurrency(todaySales)}</span> received
              {todayOrders !== null && (
                <>
                  {" "}·{" "}
                  <span className="font-semibold text-white light:text-slate-900">{todayOrders}</span>{" "}
                  new {todayOrders === 1 ? "order" : "orders"}
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {open.length === 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-2 text-sm text-emerald-100 light:border-emerald-200 light:bg-emerald-50 light:text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Nothing needs you right now
            </span>
          ) : (
            open.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${TONE[item.tone]}`}
              >
                <item.icon className="h-4 w-4" />
                <span className="tabular-nums font-bold">{item.count}</span>
                {item.label}
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
