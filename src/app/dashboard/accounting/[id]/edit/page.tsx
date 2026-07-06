import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { TransactionForm } from "@/components/accounting/transaction-form";
import { updateTransaction } from "@/lib/actions/accounting";
import type { TransactionFormState } from "@/lib/validation/accounting";
import { toDateInputValue } from "@/lib/utils";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["OWNER", "ADMIN"]);

  const transaction = await db.transaction.findUnique({
    where: { id, companyId: session.companyId },
  });

  if (!transaction) notFound();

  const action = updateTransaction.bind(null, transaction.id) as (
    state: TransactionFormState,
    formData: FormData
  ) => Promise<TransactionFormState>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Edit transaction</h1>
      <div className="mt-6">
        <TransactionForm
          action={action}
          defaultValues={{
            type: transaction.type,
            category: transaction.category,
            amount: transaction.amount,
            date: toDateInputValue(transaction.date),
            description: transaction.description,
          }}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
