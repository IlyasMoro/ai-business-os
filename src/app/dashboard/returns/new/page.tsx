import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { ReturnForm } from "@/components/returns/return-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { getReturnPolicy } from "@/lib/returns-policy";
import { isWithinReturnWindow, parseReturnReasons } from "@/lib/returns-math";

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; orderId?: string }>;
}) {
  const { error, orderId } = await searchParams;
  const session = await verifySession();
  const policy = await getReturnPolicy(session.companyId);
  if (!policy.enabled) redirect("/dashboard/returns?error=returns-disabled");

  const fulfilled = await db.order.findMany({
    where: { companyId: session.companyId, status: "FULFILLED" },
    select: {
      id: true,
      createdAt: true,
      fulfilledAt: true,
      totalAmount: true,
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const orders = fulfilled
    .filter((o) => isWithinReturnWindow(o.fulfilledAt ?? o.createdAt, policy.windowDays))
    .map((o) => ({
      id: o.id,
      label: `${o.customer.name}, ${(o.fulfilledAt ?? o.createdAt).toLocaleDateString()}, $${o.totalAmount.toFixed(2)}`,
    }));

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New return</h1>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
        {policy.requireApproval ? "The return will wait for approval once created." : "The return will start already approved."}
        {policy.windowDays > 0 && ` Orders fulfilled in the last ${policy.windowDays} days can be returned.`}
      </p>
      <div className="mt-6 max-w-xl">
        <ErrorBanner code={error} />
        <ReturnForm orders={orders} reasons={parseReturnReasons(policy.reasons)} defaultOrderId={orderId} />
      </div>
    </div>
  );
}
