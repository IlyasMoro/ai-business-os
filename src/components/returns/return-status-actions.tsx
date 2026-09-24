import { SubmitButton } from "@/components/ui-dark/submit-button";
import { updateReturnStatus } from "@/lib/actions/returns";
import { nextReturnStatuses, type ReturnStatus } from "@/lib/returns-math";

const actionLabel: Record<ReturnStatus, { text: string; pending: string; variant: "primary" | "secondary" | "danger" }> = {
  REQUESTED: { text: "Reopen", pending: "Saving...", variant: "secondary" },
  APPROVED: { text: "Approve", pending: "Approving...", variant: "primary" },
  RECEIVED: { text: "Mark received", pending: "Receiving...", variant: "primary" },
  REFUNDED: { text: "Issue refund", pending: "Refunding...", variant: "primary" },
  REJECTED: { text: "Reject", pending: "Rejecting...", variant: "danger" },
};

/** One button per move the lifecycle allows from the current status. */
export function ReturnStatusActions({ returnId, status }: { returnId: string; status: ReturnStatus }) {
  const next = nextReturnStatuses(status);
  if (next.length === 0) return null;

  const action = updateReturnStatus.bind(null, returnId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next.map((target) => (
        <form key={target} action={action}>
          <input type="hidden" name="status" value={target} />
          <SubmitButton variant={actionLabel[target].variant} pendingText={actionLabel[target].pending}>
            {actionLabel[target].text}
          </SubmitButton>
        </form>
      ))}
    </div>
  );
}
