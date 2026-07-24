export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/10 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
        <span className="bg-gradient-to-br from-amber-400 to-amber-600 bg-clip-text text-sm font-extrabold tracking-tight text-transparent">
          AIBOS
        </span>
        <p>© {new Date().getFullYear()} AIBOS. All rights reserved.</p>
      </div>
    </footer>
  );
}
