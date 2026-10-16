import Image from "next/image";

/* The AI Copilot window over the product shot: a real answer from the
   demo company, with the task it proposed and its approval status. */
export function AiTerminalPreview() {
  return (
    <div className="mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-black/70 text-left shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-5 py-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-xs font-medium text-slate-400">AI Copilot</span>
      </div>
      <Image
        src="/screenshots/feature-copilot.png"
        alt="The AI Copilot totals three overdue invoices and proposes a follow up task, which waits for approval"
        width={1580}
        height={770}
        className="w-full"
        sizes="(min-width: 768px) 560px, 100vw"
      />
    </div>
  );
}
