import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { resetPassword } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import type { ResetPasswordFormState } from "@/lib/validation/auth";

export const metadata = {
  title: "Choose a new password",
};

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
    <AuthShell
      title="Choose a new password"
      sub="Pick something you have not used here before. You will sign in with it next."
      panelEyebrow="Almost there"
      panelTitle="One new password and you are back in."
      points={[
        { icon: KeyRound, text: "A longer phrase is easier to remember and harder to guess" },
        { icon: LockKeyhole, text: "Passwords are stored scrambled, never as plain text" },
        { icon: ShieldCheck, text: "Too many wrong tries lock the account for 15 minutes" },
      ]}
    >
      <ResetPasswordForm action={action} />
    </AuthShell>
  );
}
