import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { db } from "@/lib/db";

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const user = await getCurrentUser();
  if (!isPlatformAdmin(user.email)) notFound();

  const { deleted } = await searchParams;

  const companies = await db.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
    },
  });

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Companies</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Every company workspace on this platform, visible only to the platform operator.
      </p>

      {deleted && (
        <div className="mt-4 max-w-2xl rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
          Company deleted.
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] light:border-slate-200 text-slate-400 light:text-slate-500">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Users</th>
              <th className="px-4 py-3 font-medium">Signed up</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  No companies yet.
                </td>
              </tr>
            )}
            {companies.map((company) => {
              const owner = company.users.find((u) => u.role === "OWNER") ?? company.users[0];
              return (
                <tr key={company.id} className="border-b border-white/[0.06] light:border-slate-200 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/admin/${company.id}`}
                      className="font-medium text-slate-50 light:text-slate-900 hover:text-blue-400"
                    >
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-300 light:text-slate-600">
                    {owner ? (
                      <>
                        {owner.name}
                        <span className="ml-1 text-slate-500">({owner.email})</span>
                      </>
                    ) : (
                      <span className="text-slate-500">No users</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 light:text-slate-600">{company.users.length}</td>
                  <td className="px-4 py-3 text-slate-400 light:text-slate-500">
                    {company.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
