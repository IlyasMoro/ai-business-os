import { createHash } from "crypto";
import Link from "next/link";
import { Bot, GitBranch, Users } from "lucide-react";
import { db } from "@/lib/db";
import { acceptInvite } from "@/lib/actions/team";
import { AcceptInviteForm } from "@/components/team/accept-invite-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert, authLink } from "@/components/auth/auth-fields";
import type { AcceptInviteFormState } from "@/lib/validation/team";

export const metadata = {
  title: "Join your team",
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await db.teamInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { email: true, acceptedAt: true, expiresAt: true, companyRef: { select: { name: true } } },
  });

  const isValid = invite && !invite.acceptedAt && invite.expiresAt > new Date();

  const action = acceptInvite.bind(null, token) as (
    state: AcceptInviteFormState,
    formData: FormData
  ) => Promise<AcceptInviteFormState>;

  const panel = {
    panelEyebrow: "You are invited",
    panelTitle: "Your team already works here. Jump in.",
    points: [
      { icon: Users, text: "See exactly what your role lets you open" },
      { icon: GitBranch, text: "Work in your own branch, alongside everyone else" },
      { icon: Bot, text: "Ask the AI Copilot anything about your work" },
    ],
  };

  if (!isValid) {
    return (
      <AuthShell title="This invite no longer works" {...panel}>
        <div className="space-y-6">
          <AuthAlert tone="error">
            The link is invalid, already used or expired. Ask whoever invited you to send a new one.
          </AuthAlert>
          <p className="text-center text-sm">
            <Link href="/login" className={authLink}>
              Go to sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${invite.companyRef.name}`}
      sub={
        <>
          You are accepting an invite as <span className="font-semibold text-slate-900">{invite.email}</span>.
        </>
      }
      topLink={{ lead: "Already joined?", label: "Sign in", href: "/login" }}
      {...panel}
    >
      <AcceptInviteForm action={action} />
    </AuthShell>
  );
}
