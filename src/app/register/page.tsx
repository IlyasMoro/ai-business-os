import { CreditCard, Gift, ShieldCheck } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata = {
  title: "Create your account",
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your workspace"
      sub="14 days free with every module. No credit card needed."
      topLink={{ lead: "Already have an account?", label: "Sign in", href: "/login" }}
      panelEyebrow="Free for 14 days"
      panelTitle="Everything your business runs on, ready in a minute."
      points={[
        { icon: Gift, text: "Sales, stock, invoicing, HR and the AI Copilot from day one" },
        { icon: CreditCard, text: "No card needed: choose a plan only when your trial ends" },
        { icon: ShieldCheck, text: "Your data stays yours: download a full backup any time" },
      ]}
    >
      <RegisterForm />
    </AuthShell>
  );
}
