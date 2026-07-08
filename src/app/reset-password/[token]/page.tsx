import Link from "next/link";
import { resetPassword } from "@/lib/actions/auth";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import type { ResetPasswordFormState } from "@/lib/validation/auth";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const action = resetPassword.bind(null, token) as (
    state: ResetPasswordFormState,
    formData: FormData
  ) => Promise<ResetPasswordFormState>;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
      />
      <div className="relative w-full max-w-md rounded-xl border border-white/[0.06] bg-[#111111] p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-slate-50">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter a new password for your account.
        </p>

        <ResetPasswordForm action={action} />

        <p className="mt-6 text-center text-sm text-slate-400">
          <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
