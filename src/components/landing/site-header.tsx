import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <span className="text-2xl font-extrabold tracking-tight text-blue-400">
            AIBOS
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/pricing"
            className="rounded-md px-2 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-3"
          >
            Pricing
          </Link>
          <LinkButton href="/login" variant="glass" size="sm" className="border-transparent bg-transparent hover:border-white/15 hover:bg-white/5">
            Sign in
          </LinkButton>
          <Link
            href="/register"
            className="rounded-md px-2 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-3"
          >
            Start free trial
          </Link>
        </nav>
      </div>
    </header>
  );
}
