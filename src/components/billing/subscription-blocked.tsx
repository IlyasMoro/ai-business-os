import Link from "next/link";
import { LinkButton } from "@/components/ui-dark/button";
import type { SubscriptionAccess } from "@/lib/subscription-access";

const COPY: Record<Extract<SubscriptionAccess, { blocked: true }>["reason"], { title: string; body: string }> = {
  trial_expired: {
    title: "Your trial has ended",
    body: "Subscribe to keep using Business OS for your company. Your data is safe and will be exactly as you left it.",
  },
  past_due: {
    title: "Payment failed",
    body: "We couldn't charge your card for this billing period. Update your payment method to restore access.",
  },
  canceled: {
    title: "Subscription canceled",
    body: "Your subscription has been canceled. Resubscribe to regain access to your workspace.",
  },
};

export function SubscriptionBlocked({
  reason,
}: {
  reason: Extract<SubscriptionAccess, { blocked: true }>["reason"];
}) {
  const copy = COPY[reason];
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold text-slate-50 light:text-slate-900">{copy.title}</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-500">{copy.body}</p>
      <div className="mt-6">
        <LinkButton href="/dashboard/billing">Go to billing</LinkButton>
      </div>
      <p className="mt-4 text-sm">
        <Link href="/dashboard/billing" className="text-slate-500 hover:text-slate-300 light:text-slate-600">
          Manage subscription
        </Link>
      </p>
    </div>
  );
}
