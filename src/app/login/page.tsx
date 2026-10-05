import Link from "next/link";
import { Bot, GitBranch, LayoutDashboard } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { SplitCardPage } from "@/components/landing/split-card-page";

export const metadata = {
  title: "Sign in",
};

/* Sign in, in the landing page's look: the same card as the contact page. */
export default function LoginPage() {
  return (
    <SplitCardPage
      eyebrow="Sign in"
      title="Welcome back"
      sub="Pick up where you left off: your sales, stock and money are waiting."
      panelEyebrow="Your business, ready"
      points={[
        { icon: LayoutDashboard, title: "Everything at a glance", text: "Sales, stock, money and your team on one dashboard." },
        { icon: Bot, title: "An AI that asks first", text: "The AI Copilot suggests the next step; nothing happens until you approve it." },
        { icon: GitBranch, title: "Every branch in step", text: "Switch between branches, or see the whole company at once." },
      ]}
      panelFoot={
        <>
          New to AIBOS?{" "}
          <Link href="/register" className="font-semibold text-cyan-300 hover:text-white">
            Start your free trial
          </Link>
          . 14 days, no card needed.
        </>
      }
    >
      <LoginForm />
    </SplitCardPage>
  );
}
