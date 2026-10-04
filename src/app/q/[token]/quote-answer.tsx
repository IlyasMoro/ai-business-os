"use client";

import { useActionState, useState } from "react";
import { publicButton, publicField, publicGhostButton, publicLabel } from "@/components/public/customer-shell";
import { cn } from "@/lib/utils";
import type { QuoteAnswerState } from "./actions";

type Action = (state: QuoteAnswerState, formData: FormData) => Promise<QuoteAnswerState>;

/** Accept with a typed name and a tick, or decline with an optional reason. */
export function QuoteAnswer({ accept, decline, total }: { accept: Action; decline: Action; total: string }) {
  const [mode, setMode] = useState<"accept" | "decline">("accept");
  const [agreed, setAgreed] = useState(false);
  const [acceptState, acceptAction, accepting] = useActionState(accept, undefined);
  const [declineState, declineAction, declining] = useActionState(decline, undefined);

  if (mode === "decline") {
    return (
      <form action={declineAction} className="space-y-4">
        <div>
          <label htmlFor="reason" className={publicLabel}>
            Anything we should know? <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea id="reason" name="reason" rows={3} maxLength={1000} className={publicField} placeholder="For example, the price or the timing" />
        </div>
        {declineState?.error && <p className="text-sm text-red-600">{declineState.error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={declining} className={cn(publicButton, "bg-slate-800 hover:bg-slate-900")}>
            {declining ? "Sending..." : "Decline the quote"}
          </button>
          <button type="button" onClick={() => setMode("accept")} className={publicGhostButton}>
            Go back
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={acceptAction} className="space-y-4">
      <div>
        <label htmlFor="signedName" className={publicLabel}>
          Your full name
        </label>
        <input id="signedName" name="signedName" required minLength={2} maxLength={120} autoComplete="name" className={publicField} />
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
        <input
          type="checkbox"
          name="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
        />
        <span>
          I accept this quote for <span className="font-semibold text-slate-900">{total}</span> and agree that typing my name here counts as my signature.
        </span>
      </label>
      {acceptState?.error && <p className="text-sm text-red-600">{acceptState.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!agreed || accepting} className={publicButton}>
          {accepting ? "Accepting..." : "Accept quote"}
        </button>
        <button type="button" onClick={() => setMode("decline")} className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline">
          Decline
        </button>
      </div>
    </form>
  );
}
