import { FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { formatFileSize } from "@/lib/utils";
import { uploadDocument, deleteDocument } from "@/lib/actions/documents";
import type { DocumentEntityType } from "@/generated/prisma/client";

export function DocumentsSection({
  entityType,
  entityId,
  redirectPath,
  documents,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  redirectPath: string;
  documents: { id: string; filename: string; size: number }[];
}) {
  const uploadAction = uploadDocument.bind(null, entityType, entityId, redirectPath);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length > 0 && (
          <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-2 text-sm">
                <a
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 text-slate-300 light:text-slate-600 transition-colors hover:text-blue-400"
                >
                  <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate">{doc.filename}</span>
                  <span className="shrink-0 text-xs text-slate-500">({formatFileSize(doc.size)})</span>
                </a>
                <DeleteButton
                  action={deleteDocument.bind(null, doc.id, redirectPath)}
                  confirmMessage="Delete this document?"
                  label=""
                />
              </li>
            ))}
          </ul>
        )}
        <form action={uploadAction} className="flex items-center gap-3">
          <input
            type="file"
            name="file"
            required
            className="block w-full text-sm text-slate-400 light:text-slate-500 file:mr-3 file:rounded-md file:border file:border-white/[0.06] light:border-slate-200 file:bg-[#1a1a1a] file:px-3 file:py-1.5 file:text-sm file:text-slate-300 light:text-slate-600 file:transition-colors hover:file:bg-white/5"
          />
          <SubmitButton variant="secondary" pendingText="Uploading...">
            Upload
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
