import { verifySession } from "@/lib/dal";
import { getAgendaItems } from "@/lib/agenda";
import { EventForm } from "@/components/calendar/event-form";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { deleteCalendarEvent } from "@/lib/actions/calendar";
import { CalendarClock, FileText, CheckSquare, FolderKanban, Banknote } from "lucide-react";

const KIND_ICON = {
  event: CalendarClock,
  invoice: FileText,
  task: CheckSquare,
  project: FolderKanban,
  payroll: Banknote,
} as const;

const KIND_LABEL = {
  event: "Event",
  invoice: "Invoice due",
  task: "Task due",
  project: "Project due",
  payroll: "Payroll run",
} as const;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await verifySession();

  const items = await getAgendaItems(session.companyId);

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.date.toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Calendar</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        Everything with a date across your business, plus any events you add.
      </p>

      <div className="mt-4 max-w-2xl">
        <ErrorBanner code={error} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white p-5">
        <EventForm />
      </div>

      <div className="mt-6 rounded-2xl border border-white/[0.06] light:border-slate-200 bg-[#111111] light:bg-white">
        {groups.size === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nothing scheduled.</p>
        ) : (
          <div className="divide-y divide-white/[0.06] light:divide-slate-200">
            {Array.from(groups.entries()).map(([dateKey, dateItems]) => (
              <div key={dateKey} className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {new Date(dateKey).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <ul className="mt-2 space-y-2">
                  {dateItems.map((item) => {
                    const Icon = KIND_ICON[item.kind];
                    const content = (
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-50 light:text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-500">
                            {KIND_LABEL[item.kind]}
                            {item.subtitle ? ` · ${item.subtitle}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                    return (
                      <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3">
                        {item.href ? (
                          <a href={item.href} className="min-w-0 flex-1 transition-colors hover:opacity-80">
                            {content}
                          </a>
                        ) : (
                          <div className="min-w-0 flex-1">{content}</div>
                        )}
                        {item.deletable && (
                          <DeleteButton
                            action={deleteCalendarEvent.bind(null, item.id)}
                            confirmMessage="Delete this event?"
                            label=""
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
