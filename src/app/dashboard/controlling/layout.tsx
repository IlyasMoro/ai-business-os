import { PlanGate } from "@/components/billing/plan-gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PlanGate feature="controlling">{children}</PlanGate>;
}
