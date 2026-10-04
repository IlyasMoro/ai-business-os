import Link from "next/link";
import { Mail, MessageCircle, MessageSquareText, Phone, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { deleteActivity, logActivity } from "@/lib/actions/pipeline";
import { ACTIVITY_TYPES, activityInfo, type CrmActivityType } from "@/lib/crm-pipeline";

const ICONS: Record<CrmActivityType, typeof Phone> = {
  NOTE: MessageSquareText,
  CALL: Phone,
  MEETING: Users,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
};

export type TimelineActivity = {
  id: string;
  type: CrmActivityType;
  body: string;
  occurredAt: Date;
  authorId: string | null;
  author: { name: string } | null;
  deal?: { id: string; title: string } | null;
};

function when(date: Date) {
  return date.toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * The history with a customer (or one deal): log a call, meeting, email or
 * note, newest first. Authors and owners or admins can delete an entry.
 */
export function ActivityTimeline({
  customerId,
  dealId,
  back,
  activities,
  currentUserId,
  isAdmin,
}: {
  customerId: string;
  dealId?: string;
  /** The page to return to after logging. */
  back: string;
  activities: TimelineActivity[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={logActivity} className="space-y-3">
          <input type="hidden" name="customerId" value={customerId} />
          {dealId && <input type="hidden" name="dealId" value={dealId} />}
          <input type="hidden" name="back" value={back} />
          <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div>
              <Label htmlFor={`type-${dealId ?? customerId}`}>Type</Label>
              <Select id={`type-${dealId ?? customerId}`} name="type" defaultValue="CALL">
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`when-${dealId ?? customerId}`}>When (optional, default now)</Label>
              <Input id={`when-${dealId ?? customerId}`} name="occurredAt" type="datetime-local" />
            </div>
          </div>
          <div>
            <Label htmlFor={`body-${dealId ?? customerId}`}>What happened</Label>
            <Textarea
              id={`body-${dealId ?? customerId}`}
              name="body"
              rows={2}
              required
              maxLength={5000}
              placeholder="Called about the renewal; they want a quote by Friday."
            />
          </div>
          <SubmitButton pendingText="Saving...">Log activity</SubmitButton>
        </form>

        {activities.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">Nothing logged yet. Calls, meetings, emails and notes appear here.</p>
        ) : (
          <ol className="mt-5 space-y-4 border-t border-white/[0.06] pt-4 light:border-slate-200">
            {activities.map((activity) => {
              const Icon = ICONS[activity.type];
              const canDelete = isAdmin || activity.authorId === currentUserId;
              return (
                <li key={activity.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 light:text-blue-600">
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-400 light:text-slate-500">
                      {/* No author: logged by the web form, the mailbox sync,
                          a sequence or the customer online. */}
                      {activity.author ? (
                        <>
                          <span className="font-medium text-slate-200 light:text-slate-700">{activity.author.name}</span>{" "}
                          {activityInfo(activity.type).verb}
                        </>
                      ) : (
                        <span className="font-medium text-slate-200 light:text-slate-700">Added automatically</span>
                      )}{" "}
                      · {when(activity.occurredAt)}
                      {activity.deal && (
                        <>
                          {" · "}
                          <Link href={`/dashboard/crm/deals/${activity.deal.id}`} className="text-blue-400 hover:text-blue-300 light:text-blue-700">
                            {activity.deal.title}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-200 light:text-slate-700">{activity.body}</p>
                  </div>
                  {canDelete && (
                    <DeleteButton action={deleteActivity.bind(null, activity.id)} confirmMessage="Delete this activity?" className="self-start px-1.5" />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
