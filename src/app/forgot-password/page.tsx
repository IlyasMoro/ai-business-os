import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = {
  title: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      sub="Enter your email and we will send you a link to choose a new one."
      topLink={{ lead: "Remembered it?", label: "Sign in", href: "/login" }}
      panelEyebrow="Back in a minute"
      panelTitle="Locked out? Getting back in is quick."
      points={[
        { icon: MailCheck, text: "A secure link arrives in your inbox" },
        { icon: KeyRound, text: "Choose a new password and sign straight in" },
        { icon: ShieldCheck, text: "For your safety the link expires after one hour" },
      ]}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
