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
    <div className="relative flex min-h-screen items-center justify-center bg-black px-4 light:bg-slate-50">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
      />
      <div className="relative w-full max-w-md rounded-xl border border-white/[0.06] bg-[#111111] p-8 shadow-lg light:border-slate-200 light:bg-white">
        <Link
          href="/"
          className="mb-6 inline-flex items-center rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xl font-extrabold tracking-tight text-blue-300 backdrop-blur-md light:border-blue-500/30 light:bg-blue-500/10 light:text-blue-600"
        >
          AIBOS
        </Link>
        <h1 className="text-xl font-semibold text-slate-50 light:text-slate-900">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          Enter a new password for your account.
        </p>

        <ResetPasswordForm action={action} />

        <p className="mt-6 text-center text-sm text-slate-400 light:text-slate-500">
          <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300 light:text-blue-600 light:hover:text-blue-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
