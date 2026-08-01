import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { InviteForm } from "@/components/team/invite-form";
import { revokeInvite, removeTeamMember } from "@/lib/actions/team";

const roleTone = { OWNER: "purple", ADMIN: "blue", EMPLOYEE: "slate" } as const;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await requireRole(["OWNER", "ADMIN"]);

  const [members, invites] = await Promise.all([
    db.user.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.teamInvite.findMany({
      where: { companyId: session.companyId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Team</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        {members.length} member{members.length === 1 ? "" : "s"} in {session.name ? "your company" : "this workspace"}.
      </p>

      <div className="mt-4 max-w-3xl">
        <ErrorBanner code={error} />
      </div>

      <Card className="mt-6 max-w-3xl">
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card className="mt-6 max-w-3xl">
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
              {invites.map((invite) => {
                const expired = invite.expiresAt < new Date();
                return (
                  <li key={invite.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="text-slate-50 light:text-slate-900">{invite.email}</span>
                      <Badge tone={roleTone[invite.role]}>{invite.role}</Badge>
                      {expired && <Badge tone="red">Expired</Badge>}
                    </div>
                    <DeleteButton
                      action={revokeInvite.bind(null, invite.id)}
                      confirmMessage="Revoke this invite?"
                      label="Revoke"
                    />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 max-w-3xl">
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-white/[0.06] light:divide-slate-200">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium text-slate-50 light:text-slate-900">{member.name}</span>
                    <Badge tone={roleTone[member.role]}>{member.role}</Badge>
                  </div>
                  <p className="text-slate-400 light:text-slate-500">{member.email}</p>
                </div>
                {session.role === "OWNER" && member.id !== session.userId && (
                  <DeleteButton
                    action={removeTeamMember.bind(null, member.id)}
                    confirmMessage={`Remove ${member.name} from this company?`}
                    label="Remove"
                  />
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
