import { createHash } from "crypto";
import Link from "next/link";
import { db } from "@/lib/db";
import { acceptInvite } from "@/lib/actions/team";
import { AcceptInviteForm } from "@/components/team/accept-invite-form";
import type { AcceptInviteFormState } from "@/lib/validation/team";

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

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-4 light:bg-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
      />
      <div className="relative w-full max-w-md rounded-xl border border-white/[0.06] bg-[#111111] p-8 shadow-lg light:border-slate-200 light:bg-white">
        {isValid ? (
          <>
            <h1 className="text-xl font-semibold text-slate-50 light:text-slate-900">
              Join {invite.companyRef.name}
            </h1>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              You&apos;re accepting an invite as <span className="font-medium text-slate-300 light:text-slate-700">{invite.email}</span>.
            </p>

            <AcceptInviteForm action={action} />
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-50 light:text-slate-900">Invite invalid</h1>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              This invite link is invalid or has expired. Ask whoever invited you to send a new one.
            </p>
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-400 light:text-slate-500">
          <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300 light:text-blue-600 light:hover:text-blue-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
