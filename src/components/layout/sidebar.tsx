import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import type { Role } from "./nav-config";

export function Sidebar({
  role,
  userName,
  isPlatformAdmin = false,
  hiddenHrefs,
}: {
  role: Role;
  userName: string;
  isPlatformAdmin?: boolean;
  hiddenHrefs?: string[];
}) {
  return (
    <aside className="relative z-30 hidden w-64 shrink-0 flex-col border-r border-white/[0.09] sm:flex light:border-white/80 glass-panel">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Logo />
        </Link>
      </div>
      <NavLinks role={role} isPlatformAdmin={isPlatformAdmin} hiddenHrefs={hiddenHrefs} />
      <div className="border-t border-white/[0.06] p-3 light:border-slate-200">
        <UserMenu userName={userName} />
      </div>
    </aside>
  );
}
