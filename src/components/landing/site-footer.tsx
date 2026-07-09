export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/10 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
        <span className="flex items-center gap-2 font-medium text-slate-300">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-white/10 text-[10px] font-bold text-slate-50">
            AI
          </span>
          AIBOS
        </span>
        <p>© {new Date().getFullYear()} AIBOS. All rights reserved.</p>
      </div>
    </footer>
  );
}
