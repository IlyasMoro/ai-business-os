import Link from "next/link";
import { requireRole } from "@/lib/dal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input, Label, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { importEdiDocument } from "@/lib/actions/edi";
import { BackButton } from "@/components/ui-dark/back-button";

export default async function EdiImportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireRole(["OWNER", "ADMIN"]);
  const { error } = await searchParams;

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <BackButton href="/dashboard/edi" label="Back to EDI" />
        <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">Import EDI file</h1>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
          Upload or paste an X12 850 purchase order from a trading partner. Every order in the file becomes a pending
          sales order, or the whole file is rejected with the reason. A 997 acknowledgment is prepared either way.
        </p>
        <div className="mt-6">
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
      </div>
    </div>
  );
}
