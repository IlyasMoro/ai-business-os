import Link from "next/link";
import { CreditCard, Gift, ShieldCheck } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";
import { SplitCardPage } from "@/components/landing/split-card-page";

export const metadata = {
  title: "Create your account",
};

/* Sign up, in the landing page's look: the same card as the contact page. */
export default function RegisterPage() {
  return (
    <SplitCardPage
      eyebrow="Free trial"
      title="Create your workspace"
      sub="14 days free with every module, no credit card needed."
      panelEyebrow="Free for 14 days"
      points={[
        { icon: Gift, title: "Every module included", text: "Sales, stock, invoicing, HR and the AI Copilot from day one." },
        { icon: CreditCard, title: "No card needed", text: "Start now and choose a plan only when your trial ends." },
        { icon: ShieldCheck, title: "Your data stays yours", text: "Download a full backup of your company whenever you like." },
      ]}
      panelFoot={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-cyan-300 hover:text-white">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </SplitCardPage>
  );
}
