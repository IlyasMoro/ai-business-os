"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { fieldStyles } from "@/components/ui-dark/input";
import { cn } from "@/lib/utils";

/** A read only value (a link, an embed code) with a Copy button. */
export function CopyField({ value, label, multiline = false }: { value: string; label: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (an old browser or no permission): the text is
      // selectable, so people can still copy it by hand.
    }
  };
  return (
    <div className="flex items-start gap-2">
      {multiline ? (
        <textarea readOnly aria-label={label} value={value} rows={3} onFocus={(e) => e.currentTarget.select()} className={fieldStyles("font-mono text-xs")} />
      ) : (
        <input readOnly aria-label={label} value={value} onFocus={(e) => e.currentTarget.select()} className={fieldStyles("font-mono text-xs")} />
      )}
      <button
        type="button"
        onClick={copy}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          copied
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 light:text-emerald-700"
            : "border-white/10 text-slate-200 hover:bg-white/5 light:border-slate-300 light:text-slate-700 light:hover:bg-slate-50"
        )}
      >
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
