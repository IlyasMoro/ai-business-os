import { TransactionForm } from "@/components/accounting/transaction-form";
import { createTransaction } from "@/lib/actions/accounting";
import { dateInputDaysFromNow } from "@/lib/utils";

export default function NewTransactionPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">New transaction</h1>
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
