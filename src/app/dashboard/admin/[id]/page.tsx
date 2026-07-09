import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { db } from "@/lib/db";
import { deleteCompany } from "@/lib/actions/admin";
import { DeleteCompanyForm } from "@/components/admin/delete-company-form";
import { ErrorBanner } from "@/components/ui/error-banner";

export default async function AdminCompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!isPlatformAdmin(user.email)) notFound();

  const { id } = await params;
  const { error } = await searchParams;

  const company = await db.company.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
    },
  });

  if (!company) notFound();

  const deleteAction = deleteCompany.bind(null, company.id);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <Link href="/dashboard/admin" className="text-sm text-blue-400 hover:text-blue-300">
        Back to companies
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-slate-50">{company.name}</h1>
      <p className="mt-1 text-sm text-slate-400">
        Signed up on {company.createdAt.toLocaleDateString()}
      </p>

      <div className="mt-4 max-w-2xl">
        <ErrorBanner code={error} />
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-white/[0.06] bg-[#111111] p-5">
        <h2 className="font-medium text-slate-50">Users ({company.users.length})</h2>
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {company.users.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="text-slate-200">{u.name}</p>
                <p className="text-slate-500">{u.email}</p>
              </div>
              <div className="text-right text-slate-400">
                <p>{u.role}</p>
                <p className="text-xs text-slate-500">
                  joined {u.createdAt.toLocaleDateString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <h2 className="font-medium text-red-400">Danger zone</h2>
        <div className="mt-3">
          <DeleteCompanyForm companyName={company.name} action={deleteAction} />
        </div>
      </div>
    </div>
  );
}
