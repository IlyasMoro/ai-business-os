import Link from "next/link";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import type { Role } from "./nav-config";

export function Sidebar({
  role,
  userName,
  isPlatformAdmin = false,
}: {
  role: Role;
  userName: string;
  isPlatformAdmin?: boolean;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-black sm:flex light:border-slate-200 light:bg-white">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" className="flex items-center">
          <span className="text-xl font-extrabold tracking-tight text-blue-300 light:text-blue-600">
            AIBOS
          </span>
        </Link>
      </div>
      <NavLinks role={role} isPlatformAdmin={isPlatformAdmin} />
      <div className="border-t border-white/[0.06] p-3 light:border-slate-200">
        <UserMenu userName={userName} />
      </div>
    </aside>
  );
}
