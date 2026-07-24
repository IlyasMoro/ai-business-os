import Link from "next/link";
import { NavLinks } from "./nav-links";
import type { Role } from "./nav-config";

export function Sidebar({ role, isPlatformAdmin = false }: { role: Role; isPlatformAdmin?: boolean }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-black sm:flex light:border-slate-200 light:bg-white">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="flex items-center">
          <span className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xl font-extrabold tracking-tight text-blue-300 backdrop-blur-md light:border-blue-500/30 light:bg-blue-500/10 light:text-blue-600">
            AIBOS
          </span>
        </Link>
      </div>
      <NavLinks role={role} isPlatformAdmin={isPlatformAdmin} />
    </aside>
  );
}
