import Link from "next/link";
import { Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { createReturn } from "@/lib/actions/returns";

export function ReturnForm({
  orders,
  reasons,
  defaultOrderId,
}: {
  orders: { id: string; label: string }[];
  reasons: string[];
  defaultOrderId?: string;
}) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-slate-400 light:text-slate-500">
        There are no fulfilled orders inside the return window right now.{" "}
        <Link href="/dashboard/sales" className="text-blue-400 hover:text-blue-300">
          View orders
        </Link>
        .
      </p>
    );
  }

  const selected = orders.some((o) => o.id === defaultOrderId) ? defaultOrderId : "";

  return (
    <form action={createReturn} className="max-w-xl space-y-4">
      <div>
        <Label htmlFor="orderId">Order</Label>
        <Select id="orderId" name="orderId" defaultValue={selected} required>
          <option value="" disabled>
            Select a fulfilled order
          </option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="reason">Reason</Label>
        {reasons.length > 0 ? (
          <Select id="reason" name="reason" defaultValue="" required>
            <option value="" disabled>
              Select a reason
            </option>
            {reasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
            <option value="Other">Other</option>
          </Select>
        ) : (
          <Textarea id="reason" name="reason" rows={2} required maxLength={200} />
        )}
      </div>
      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={3} maxLength={2000} placeholder="Anything the warehouse or finance team should know" />
      </div>
      <SubmitButton pendingText="Creating...">Create return</SubmitButton>
    </form>
  );
}
