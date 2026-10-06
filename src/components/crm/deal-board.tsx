"use client";

import { useOptimistic, useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { moveDeal } from "@/lib/actions/pipeline";
import { DEAL_STAGES, type DealStage } from "@/lib/crm-pipeline";
import { cn } from "@/lib/utils";

export type BoardDeal = {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  probability: number;
  position: number;
  expectedClose: string | null;
  customerName: string;
  ownerName: string | null;
};

function money(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Overdue close dates on open deals stand out. */
function closeLabel(iso: string | null, stage: DealStage) {
  if (!iso) return null;
  const date = new Date(iso);
  const late = (stage !== "WON" && stage !== "LOST") && date < new Date(new Date().toDateString());
  return { text: date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }), late };
}

/**
 * The pipeline board: one column per stage, deals as cards. Drag a card to
 * another column (or between two cards) to move it; the board updates at
 * once and the server saves the new stage and order. Each column shows its
 * count and total value.
 */
export function DealBoard({ deals }: { deals: BoardDeal[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, applyMove] = useOptimistic(
    deals,
    (current, move: { id: string; stage: DealStage; position: number }) =>
      current.map((d) => (d.id === move.id ? { ...d, stage: move.stage, position: move.position } : d))
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);

  const columns = DEAL_STAGES.map((stage) => ({
    ...stage,
    deals: optimistic.filter((d) => d.stage === stage.id).sort((a, b) => a.position - b.position),
  }));

  // Drops onto a card land before it; drops onto empty space land at the end.
  const drop = (stage: DealStage, beforeCardId: string | null) => (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOverStage(null);
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    if (!id || id === beforeCardId) return;
    const column = columns.find((c) => c.id === stage)!.deals.filter((d) => d.id !== id);
    const index = beforeCardId ? column.findIndex((d) => d.id === beforeCardId) : column.length;
    const before = index > 0 ? column[index - 1] : null;
    const after = index >= 0 && index < column.length ? column[index] : null;
    const position = before && after ? (before.position + after.position) / 2 : before ? before.position + 1000 : after ? after.position - 1000 : 1000;
    startTransition(async () => {
      applyMove({ id, stage, position });
      await moveDeal(id, stage, before?.id ?? null, after?.id ?? null);
    });
  };

  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
      {columns.map((column) => {
        const total = column.deals.reduce((sum, d) => sum + d.value, 0);
        return (
          <section
            key={column.id}
            aria-label={`${column.label}, ${column.deals.length} ${column.deals.length === 1 ? "deal" : "deals"}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(column.id);
            }}
            onDragLeave={() => setOverStage((s) => (s === column.id ? null : s))}
            onDrop={drop(column.id, null)}
            className={cn(
              "flex w-64 shrink-0 flex-col rounded-xl border p-2 transition-colors",
              overStage === column.id ? "border-blue-500/60 bg-blue-500/[0.06]" : "border-white/[0.08] bg-white/[0.02] light:border-slate-200 light:bg-slate-50"
            )}
          >
            <header className="flex items-baseline justify-between gap-2 px-1.5 pb-2 pt-1">
              <h2 className="text-sm font-semibold text-slate-100 light:text-slate-800">
                {column.label}
                <span className="ml-1.5 text-xs font-normal text-slate-500">{column.deals.length}</span>
              </h2>
              <span className="text-xs tabular-nums text-slate-400">{money(total)}</span>
            </header>
            <div className="flex min-h-24 flex-1 flex-col gap-2">
              {column.deals.map((deal) => {
                const close = closeLabel(deal.expectedClose, deal.stage);
                return (
                  <article
                    key={deal.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", deal.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(deal.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={drop(column.id, deal.id)}
                    className={cn(
                      "cursor-grab rounded-lg border border-white/[0.09] bg-[#0f1729] p-3 shadow-sm transition-opacity active:cursor-grabbing light:border-slate-200 light:bg-white",
                      dragId === deal.id && "opacity-40"
                    )}
                  >
                    <Link
                      href={`/dashboard/crm/deals/${deal.id}`}
                      className="block text-sm font-semibold text-slate-50 hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 light:text-slate-900"
                    >
                      {deal.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-slate-400 light:text-slate-500">{deal.customerName}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold tabular-nums text-slate-100 light:text-slate-800">{money(deal.value)}</span>
                      {column.open && <span className="tabular-nums text-slate-500">{deal.probability}%</span>}
                    </div>
                    {(close || deal.ownerName) && (
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500">
                        {close ? (
                          <span className={cn("inline-flex items-center gap-1", close.late && "text-red-400 light:text-red-600")}>
                            <CalendarClock aria-hidden className="h-3 w-3" />
                            {close.text}
                          </span>
                        ) : (
                          <span />
                        )}
                        {deal.ownerName && <span className="truncate">{deal.ownerName}</span>}
                      </div>
                    )}
                  </article>
                );
              })}
              {column.deals.length === 0 && (
                <p className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-slate-500 light:border-slate-300">
                  Drop a deal here
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
