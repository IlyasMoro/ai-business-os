import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge, StatusBadge } from "@/components/ui-dark/badge";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { Select } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { getCompanyBranches } from "@/lib/branches";
import { setUserBranchAccess } from "@/lib/actions/branches";
import { ErrorBanner } from "@/components/ui/error-banner";
import { InviteForm } from "@/components/team/invite-form";
import { revokeInvite, removeTeamMember } from "@/lib/actions/team";
import { setMemberRole } from "@/lib/actions/roles";
import { listCompanyRoles } from "@/lib/company-roles";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { buttonStyles } from "@/components/ui-dark/button";
import { canBillExtraUsers, getCompanyPlan, seatsUsed } from "@/lib/plan-limits";
import { EXTRA_USER_PRICE, MAX_USERS } from "@/lib/plans";

const roleTone = { OWNER: "purple", ADMIN: "blue", EMPLOYEE: "slate" } as const;

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const session = await requireRole(["OWNER", "ADMIN"]);

  const [members, invites, branches, plan, seats, billable, companyRoles] = await Promise.all([
    db.user.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true, email: true, role: true, branchId: true, createdAt: true, companyRole: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.teamInvite.findMany({
      where: { companyId: session.companyId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      include: { companyRole: { select: { name: true } } },
    }),
    getCompanyBranches(session.companyId),
    getCompanyPlan(session.companyId),
    seatsUsed(session.companyId),
    canBillExtraUsers(session.companyId),
    listCompanyRoles(session.companyId),
  ]);
  const isOwner = session.role === "OWNER";
  // Only offer the branch control once there is more than one branch to pick.
  const showBranchAccess = branches.length > 1;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Team</h1>
        {isOwner && (
          <Link href="/dashboard/team/roles" className={buttonStyles("secondary", "md")}>
            <ShieldCheck className="h-4 w-4" />
            Roles and access
          </Link>
        )}
        </div>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          {members.length} member{members.length === 1 ? "" : "s"} in {session.name ? "your company" : "this workspace"}.
        </p>

        <div className="mt-4 space-y-3">
          <ErrorBanner code={error} />
          {saved && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">Saved.</p>}
        </div>

        {/* Extra wide screens: the invite form in a narrow column beside the
            lists. Otherwise it sits on top so the members table gets the full width. */}
        <div className="mt-6 grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Invite a teammate</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Seats count open invites; past the plan's users each new member is billed. */}
              <p className="mb-4 text-sm text-slate-400 light:text-slate-500">
                {seats} {seats === 1 ? "user" : "users"}, counting open invites. The {plan.name} plan includes {plan.users}.{" "}
                {plan.id === "scale" && !plan.extraUsers
                  ? "For more, the owner can add users to the plan on the Billing page."
                  : seats >= MAX_USERS || plan.users >= MAX_USERS
                  ? `For more than ${MAX_USERS}, the owner can build an Enterprise plan on the Billing page.`
                  : !plan.extraUsers
                    ? "For more, the owner can move to Starter on the Billing page."
                    : billable
                    ? `More are $${EXTRA_USER_PRICE} each a month, charged from the day they join.`
                    : seats >= plan.users
                      ? "To add more, the owner can subscribe to a plan on the Billing page."
                      : `After that, extra users are $${EXTRA_USER_PRICE} each a month.`}
              </p>
              <InviteForm companyRoles={companyRoles.map((r) => ({ id: r.id, name: r.name }))} />
            </CardContent>
          </Card>

          <div className="space-y-6">
            {invites.length > 0 && (
              <Card>
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
                            {invite.companyRole ? <Badge tone="blue">{invite.companyRole.name}</Badge> : <StatusBadge status={invite.role} tone={roleTone[invite.role]} />}
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

            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
              </CardHeader>
              <CardContent>
                {/* A full width table: each member's details spread across
                    the card instead of bunched on the left. */}
                <div className="-mx-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wide text-slate-500 light:border-slate-200">
                        <th className="px-2 py-2 font-medium">Member</th>
                        <th className="px-2 py-2 font-medium">Email</th>
                        <th className="px-2 py-2 font-medium">Role</th>
                        <th className="px-2 py-2 font-medium">Joined</th>
                        {showBranchAccess && <th className="px-2 py-2 font-medium">Branch access</th>}
                        <th className="px-2 py-2" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] light:divide-slate-200">
                      {members.map((member) => (
                        <tr key={member.id} className="align-middle">
                          <td className="px-2 py-3">
                            <span className="flex items-center gap-3">
                              <span
                                aria-hidden
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-semibold text-blue-300 light:bg-blue-100 light:text-blue-700"
                              >
                                {member.name
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((w) => w[0]!.toUpperCase())
                                  .join("")}
                              </span>
                              <span className="whitespace-nowrap font-semibold text-slate-50 light:text-slate-900">
                                {member.name}
                                {member.id === session.userId && <span className="ml-2 text-xs font-normal text-slate-500">You</span>}
                              </span>
                            </span>
                          </td>
                          <td className="max-w-[18rem] truncate px-2 py-3 text-slate-300 light:text-slate-600">
                            <a href={`mailto:${member.email}`} title={member.email} className="hover:text-blue-400">
                              {member.email}
                            </a>
                          </td>
                          <td className="px-2 py-3">
                            {isOwner && member.role !== "OWNER" && member.id !== session.userId ? (
                              <form action={setMemberRole.bind(null, member.id)} className="flex items-center gap-2">
                                <Select
                                  name="role"
                                  defaultValue={member.companyRole ? `role:${member.companyRole.id}` : member.role}
                                  aria-label={`Role for ${member.name}`}
                                  className="w-44"
                                >
                                  {companyRoles.length > 0 && (
                                    <optgroup label="Company roles">
                                      {companyRoles.map((r) => (
                                        <option key={r.id} value={`role:${r.id}`}>
                                          {r.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <optgroup label="Built in">
                                    <option value="ADMIN">Admin</option>
                                    <option value="EMPLOYEE">Employee</option>
                                  </optgroup>
                                </Select>
                                <SubmitButton pendingText="Saving..." variant="secondary">
                                  Save
                                </SubmitButton>
                              </form>
                            ) : member.companyRole ? (
                              <Badge tone="blue">{member.companyRole.name}</Badge>
                            ) : (
                              <StatusBadge status={member.role} tone={roleTone[member.role]} />
                            )}
                          </td>
                          <td className="px-2 py-3 whitespace-nowrap text-slate-400 light:text-slate-500">{member.createdAt.toLocaleDateString()}</td>
                          {showBranchAccess && (
                            <td className="px-2 py-3">
                              {/* Staff, and managers with a company role (a Branch manager), can be kept to one branch. */}
                              {member.role === "EMPLOYEE" || (member.role === "ADMIN" && member.companyRole) ? (
                                <form action={setUserBranchAccess.bind(null, member.id)} className="flex items-center gap-2">
                                  <Select
                                    name="branchId"
                                    defaultValue={member.branchId ?? ""}
                                    aria-label={`Branch access for ${member.name}`}
                                    className="w-44"
                                  >
                                    <option value="">All branches</option>
                                    {branches
                                      .filter((b) => b.active || b.id === member.branchId)
                                      .map((b) => (
                                        <option key={b.id} value={b.id}>
                                          Only {b.name}
                                        </option>
                                      ))}
                                  </Select>
                                  <SubmitButton pendingText="Saving..." variant="secondary">
                                    Save
                                  </SubmitButton>
                                </form>
                              ) : (
                                <span className="text-slate-500">All branches</span>
                              )}
                            </td>
                          )}
                          <td className="px-2 py-3 text-right">
                            {session.role === "OWNER" && member.id !== session.userId && (
                              <DeleteButton
                                action={removeTeamMember.bind(null, member.id)}
                                confirmMessage={`Remove ${member.name} from this company?`}
                                label="Remove"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
