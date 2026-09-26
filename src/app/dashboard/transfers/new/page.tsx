import Link from "next/link";
import { getBranchContext } from "@/lib/branches";
import { createTransfer } from "@/lib/actions/transfers";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";

export default async function NewTransferPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const ctx = await getBranchContext();
  const active = ctx.branches.filter((b) => b.active);

  // Sends from the user's own branch, or the one in view, else main.
  const fromId = ctx.lockedBranchId ?? ctx.viewBranchId ?? active.find((b) => b.isMain)?.id ?? active[0]?.id;
  const toId = active.find((b) => b.id !== fromId)?.id;
  const fromBranch = active.find((b) => b.id === fromId);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New transfer</h1>
      <div className="mt-4 max-w-xl">
        <ErrorBanner code={error} />
      </div>
      {active.length < 2 ? (
        <p className="mt-6 max-w-xl text-sm text-slate-400 light:text-slate-500">
          Transfers need at least two active branches.{" "}
          <Link href="/dashboard/branches" className="text-blue-400 hover:text-blue-300">
            Add a branch
          </Link>{" "}
          first.
        </p>
      ) : (
        <form action={createTransfer} className="mt-6 max-w-xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fromBranchId">From</Label>
              {ctx.lockedBranchId ? (
                <>
                  <input type="hidden" name="fromBranchId" value={ctx.lockedBranchId} />
                  <p className="py-2 text-sm text-slate-200 light:text-slate-700">{fromBranch?.name}</p>
                </>
              ) : (
                <Select id="fromBranchId" name="fromBranchId" defaultValue={fromId}>
                  {active.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <Label htmlFor="toBranchId">To</Label>
              <Select id="toBranchId" name="toBranchId" defaultValue={toId}>
                {active.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" name="note" rows={2} maxLength={500} placeholder="Why this stock is moving" />
          </div>
          <SubmitButton pendingText="Creating...">Create transfer</SubmitButton>
        </form>
      )}
    </div>
  );
}
