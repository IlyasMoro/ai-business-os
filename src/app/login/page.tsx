import { Bot, GitBranch, LayoutDashboard, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { enabledProviders, providerLabel } from "@/lib/oauth-login";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  // Google / Microsoft buttons show only once their keys are set.
  const providers = enabledProviders().map((id) => ({ id, label: providerLabel(id) }));

  return (
    <AuthShell
      title="Sign in"
      sub="Welcome back. Your sales, stock and money are waiting."
      topLink={{ lead: "New to AIBOS?", label: "Start free trial", href: "/register" }}
      panelEyebrow="Your business, ready"
      panelTitle="Run every branch from one calm screen."
      points={[
        { icon: LayoutDashboard, text: "Sales, stock, money and your team on one dashboard" },
        { icon: Bot, text: "An AI Copilot that suggests, and waits for your approval" },
        { icon: GitBranch, text: "Every branch on its own, or the whole company at once" },
      ]}
      below={
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Encrypted sign in. Five wrong passwords lock the account for 15 minutes.
        </span>
      }
    >
      <LoginForm providers={providers} />
    </AuthShell>
  );
}
