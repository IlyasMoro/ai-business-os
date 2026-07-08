import { TransactionForm } from "@/components/accounting/transaction-form";
import { createTransaction } from "@/lib/actions/accounting";
import { dateInputDaysFromNow } from "@/lib/utils";
import { requireRole } from "@/lib/dal";

export default async function NewTransactionPage() {
  await requireRole(["OWNER", "ADMIN"]);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-50">New transaction</h1>
      <div className="mt-6">
        <TransactionForm
          action={createTransaction}
          defaultValues={{
            type: "INCOME",
            category: "",
            amount: 0,
            date: dateInputDaysFromNow(0),
            description: "",
          }}
          submitLabel="Create transaction"
        />
      </div>
    </div>
  );
}
