import { getCurrentUser } from "@/lib/dal";

export default async function DashboardOverviewPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Welcome back, {user.name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-slate-500">
        Here&apos;s what&apos;s happening at {user.company.name}.
      </p>
    </div>
  );
}
