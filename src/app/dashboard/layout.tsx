import { getCurrentUser } from "@/lib/dal";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* The dashboard's dark analytics look is hardcoded against the
          default (non-retargeted) slate palette. The root theme-init
          script can set data-theme="dark" from OS preference, which
          remaps slate-900 etc. to near-white for the toggle-based
          light/dark pages — turning our dark cards gray. Pin it back. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.setAttribute("data-theme","light")`,
        }}
      />
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar companyName={user.company.name} userName={user.name} role={user.role} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
