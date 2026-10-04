import Link from "next/link";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { FollowUpRow } from "@/components/crm/follow-up-list";
import { followUpBucket } from "@/lib/crm-pipeline";
import { cn } from "@/lib/utils";
import { followUpScope } from "@/lib/crm-access";

export const metadata = { title: "Reminders" };

const GROUPS = [
  { id: "overdue", title: "Overdue" },
  { id: "today", title: "Today" },
  { id: "upcoming", title: "Upcoming" },
  { id: "done", title: "Done in the last 7 days" },
] as const;

/** Reminders across all customers, mine by default, grouped by when they're due. */
export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const session = await verifySession();
  const { all } = await searchParams;
  const everyone = all === "1";
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const followUps = await db.followUp.findMany({
    where: {
      companyId: session.companyId,
      ...(await followUpScope()),
      ...(everyone ? {} : { assigneeId: session.userId }),
      OR: [{ doneAt: null }, { doneAt: { gte: weekAgo } }],
    },
    orderBy: { dueAt: "asc" },
    take: 300,
    include: {
      assignee: { select: { name: true } },
      customer: { select: { id: true, name: true } },
      deal: { select: { id: true, title: true } },
    },
  });

  const grouped = Object.fromEntries(GROUPS.map((g) => [g.id, followUps.filter((f) => followUpBucket(f, now) === g.id)]));
  const openCount = followUps.filter((f) => !f.doneAt).length;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50 light:text-slate-900">Reminders</h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            {openCount} open · add them from a customer or a deal.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm light:border-slate-200 light:bg-slate-100">
          {[
            { href: "/dashboard/crm/reminders", label: "Mine", on: !everyone },
            { href: "/dashboard/crm/reminders?all=1", label: "Everyone", on: everyone },
          ].map((f) => (
            <Link
              key={f.label}
              href={f.href}
              aria-current={f.on ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                f.on ? "bg-blue-600 font-medium text-white" : "text-slate-300 hover:text-white light:text-slate-600 light:hover:text-slate-900"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>


      {followUps.length === 0 ? (
        <div className="mx-auto mt-8 max-w-md rounded-xl border border-dashed border-white/15 p-8 text-center light:border-slate-300">
          <p className="font-semibold text-slate-100 light:text-slate-800">Nothing to follow up</p>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
            Open a customer or a deal and add a reminder, such as &quot;Call back on Friday&quot;.
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-4xl space-y-6">
          {GROUPS.map((group) =>
            grouped[group.id].length === 0 ? null : (
              <section key={group.id} className="rounded-2xl border border-white/[0.09] p-5 glass light:border-white/80">
                <h2
                  className={cn(
                    "text-sm font-semibold",
                    group.id === "overdue" ? "text-red-400 light:text-red-600" : group.id === "today" ? "text-amber-400 light:text-amber-600" : "text-slate-100 light:text-slate-800"
                  )}
                >
                  {group.title} <span className="font-normal text-slate-500">{grouped[group.id].length}</span>
                </h2>
                <ul className="mt-2 divide-y divide-white/[0.06] light:divide-slate-200">
                  {grouped[group.id].map((f) => (
                    <FollowUpRow key={f.id} followUp={f} showCustomer />
                  ))}
                </ul>
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
}
