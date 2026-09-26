import { TransactionForm } from "@/components/accounting/transaction-form";
import { createTransaction } from "@/lib/actions/accounting";
import { dateInputDaysFromNow } from "@/lib/utils";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { loadCostObjectOptions } from "@/lib/controlling";
import { moneyBranchPicker } from "@/lib/branches";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function NewTransactionPage() {
  const session = await requireRole(["OWNER", "ADMIN"]);

  const [existing, projects, costObjects, branches] = await Promise.all([
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
    loadCostObjectOptions(session.companyId),
    moneyBranchPicker(),
  ]);

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/accounting" label="Back to accounting" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">New transaction</h1>
        <div className="mt-6 rounded-2xl border border-white/[0.09] p-6 glass light:border-white/80">
          <TransactionForm
            action={createTransaction}
            defaultValues={{
              type: "INCOME",
              category: "",
              amount: 0,
              date: dateInputDaysFromNow(0),
              description: "",
            }}
            existingCategories={existing.map((t) => t.category)}
            projects={projects}
            costObjects={costObjects}
            branches={branches}
            submitLabel="Create transaction"
          />
        </div>
      </div>
    </div>
  );
}
