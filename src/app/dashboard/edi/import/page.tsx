import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { importEdiDocument } from "@/lib/actions/edi";

export default async function EdiImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole(["OWNER", "ADMIN"]);
  const { error } = await searchParams;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6 light:bg-white">
      <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Import EDI file</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-400 light:text-slate-500">
        Upload or paste an X12 850 purchase order from a trading partner. Every order in the file becomes a pending
        sales order, or the whole file is rejected with the reason. A 997 acknowledgment is prepared either way.
      </p>
      <div className="mt-6 max-w-2xl">
        <ErrorBanner code={error} />
        <form action={importEdiDocument} className="space-y-4">
          <div>
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" accept=".edi,.x12,.txt,text/plain,application/edi-x12" />
          </div>
          <div>
            <Label htmlFor="content">Or paste the contents</Label>
            <Textarea id="content" name="content" rows={12} className="font-mono text-xs" placeholder="ISA*00*..." />
          </div>
          <SubmitButton pendingText="Importing...">Import</SubmitButton>
        </form>
      </div>
      <p className="mt-6">
        <Link href="/dashboard/edi" className="text-sm text-slate-500 hover:text-slate-300 light:text-slate-600">
          ← Back to EDI
        </Link>
      </p>
    </div>
  );
}
