import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { Badge } from "@/components/ui-dark/badge";
import { LinkButton } from "@/components/ui-dark/button";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { deleteTransaction } from "@/lib/actions/accounting";
import { Pencil } from "lucide-react";

const typeTone = {
  INCOME: "green",
  EXPENSE: "red",
} as const;

export default async function TransactionDetailPage({
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

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-slate-950 p-4 sm:-m-6 sm:p-6">
      <div className="max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white">{transaction.category}</h1>
              <Badge tone={typeTone[transaction.type]}>{transaction.type}</Badge>
            </div>
            <p className="mt-1 text-slate-400">{transaction.date.toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <LinkButton
              href={`/dashboard/accounting/${transaction.id}/edit`}
              variant="secondary"
              size="sm"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </LinkButton>
            <DeleteButton action={deleteTransaction.bind(null, transaction.id)} />
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Amount</p>
              <p
                className={`font-mono tabular-nums ${
                  transaction.type === "EXPENSE" ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {transaction.type === "EXPENSE" ? "-" : ""}${transaction.amount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Category</p>
              <p className="text-white">{transaction.category}</p>
            </div>
            {transaction.description && (
              <div className="col-span-2">
                <p className="text-slate-500">Description</p>
                <p className="whitespace-pre-wrap text-white">{transaction.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-6">
          <Link href="/dashboard/accounting" className="text-sm text-slate-500 hover:text-slate-300">
            ← Back to accounting
          </Link>
        </p>
      </div>
    </div>
  );
}
