import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { db } from "@/lib/db";
import { topicLabel } from "@/lib/contact";
import { setContactMessageHandled } from "@/lib/actions/contact";
import { cn } from "@/lib/utils";

/* Messages from the public contact form, visible only to the platform
   operator. Open messages first; "Handled" moves one out of the way. */
export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await getCurrentUser();
  if (!isPlatformAdmin(user.email)) notFound();

  const { show } = await searchParams;
  const showAll = show === "all";

  const [messages, openCount] = await Promise.all([
    db.contactMessage.findMany({
      where: showAll ? {} : { handledAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.contactMessage.count({ where: { handledAt: null } }),
  ]);

  const tab = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-blue-500/15 text-white light:bg-blue-500/10 light:text-blue-700"
        : "text-slate-400 hover:text-slate-100 light:text-slate-500 light:hover:text-slate-900"
    );

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Messages</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        What visitors sent through the contact page. Reply by email, then mark the message handled.
      </p>

      <div className="mt-5 flex gap-1">
        <Link href="/dashboard/admin/messages" className={tab(!showAll)}>
          Open ({openCount})
        </Link>
        <Link href="/dashboard/admin/messages?show=all" className={tab(showAll)}>
          All
        </Link>
      </div>

      <ul className="mt-4 max-w-4xl space-y-3">
        {messages.length === 0 && (
          <li className="rounded-2xl border border-white/[0.09] px-4 py-8 text-center text-sm text-slate-500 glass light:border-white/80">
            {showAll ? "No messages yet." : "Nothing open. You're all caught up."}
          </li>
        )}
        {messages.map((m) => {
          const handled = m.handledAt !== null;
          const reply = `mailto:${m.email}?subject=${encodeURIComponent(`Re: your message to AIBOS (${topicLabel(m.topic)})`)}`;
          return (
            <li
              key={m.id}
              className={cn("rounded-2xl border border-white/[0.09] p-4 glass light:border-white/80", handled && "opacity-60")}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold text-slate-50 light:text-slate-900">
                  {m.name}
                  <span className="ml-2 text-sm font-normal text-slate-400 light:text-slate-500">
                    {m.email}
                    {m.company && `, ${m.company}`}
                  </span>
                </p>
                <p className="text-xs text-slate-500">{m.createdAt.toLocaleString()}</p>
              </div>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-violet-300 light:text-violet-700">
                {topicLabel(m.topic)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300 light:text-slate-700">{m.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <a href={reply} className="font-medium text-blue-400 hover:text-blue-300 light:text-blue-700">
                  Reply by email
                </a>
                <form action={setContactMessageHandled.bind(null, m.id, !handled)}>
                  <button
                    type="submit"
                    className="rounded-md border border-white/10 px-2.5 py-1 text-slate-300 hover:bg-white/[0.07] light:border-slate-300 light:text-slate-700 light:hover:bg-slate-900/5"
                  >
                    {handled ? "Open again" : "Mark handled"}
                  </button>
                </form>
                {handled && <span className="text-xs text-slate-500">Handled {m.handledAt!.toLocaleDateString()}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
