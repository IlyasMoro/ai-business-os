import Link from "next/link";
import { NavLinks } from "./nav-links";
import type { Role } from "./nav-config";

export function Sidebar({ role, isPlatformAdmin = false }: { role: Role; isPlatformAdmin?: boolean }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-black sm:flex light:border-slate-200 light:bg-white">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-7 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/20 px-2 text-xs font-bold tracking-wide text-amber-400">
            AIBOS
          </span>
        </Link>
      </div>
      <NavLinks role={role} isPlatformAdmin={isPlatformAdmin} />
    </aside>
  );
}
