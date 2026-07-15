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

  const [transaction, existing, projects] = await Promise.all([
    db.transaction.findUnique({ where: { id, companyId: session.companyId } }),
    db.transaction.findMany({
      where: { companyId: session.companyId },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    db.project.findMany({
      where: { companyId: session.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!transaction) notFound();

  const action = updateTransaction.bind(null, transaction.id) as (
    state: TransactionFormState,
    formData: FormData
  ) => Promise<TransactionFormState>;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Edit transaction</h1>
      <div className="mt-6">
        <TransactionForm
          action={action}
          defaultValues={{
            type: transaction.type,
            category: transaction.category,
            amount: transaction.amount,
            date: toDateInputValue(transaction.date),
            description: transaction.description,
            projectId: transaction.projectId,
          }}
          existingCategories={existing.map((t) => t.category)}
          projects={projects}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
