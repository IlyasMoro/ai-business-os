import { PlanGate } from "@/components/billing/plan-gate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PlanGate feature="transfers">{children}</PlanGate>;
}
