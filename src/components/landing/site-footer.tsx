export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/10 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
        <span className="text-sm font-extrabold tracking-tight text-blue-400">
          AIBOS
        </span>
        <p>© {new Date().getFullYear()} AIBOS. All rights reserved.</p>
      </div>
    </footer>
  );
}
