import { FileArchive, FileImage, FileSpreadsheet, FileText, File as FileIcon, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { formatFileSize } from "@/lib/utils";
import { uploadDocument, deleteDocument, type DocumentUploadState } from "@/lib/actions/documents";
import { verifySession, hasRole } from "@/lib/dal";
import { fileKind, opensInBrowser, type FileKind } from "@/lib/document-files";
import { DocumentDropzone } from "@/components/documents/document-dropzone";
import type { DocumentEntityType } from "@/generated/prisma/client";

const KIND_ICON: Record<FileKind, { icon: typeof FileText; color: string }> = {
  pdf: { icon: FileText, color: "text-red-400 bg-red-500/10" },
  image: { icon: FileImage, color: "text-violet-400 bg-violet-500/10" },
  sheet: { icon: FileSpreadsheet, color: "text-emerald-400 bg-emerald-500/10" },
  doc: { icon: FileText, color: "text-blue-400 bg-blue-500/10" },
  archive: { icon: FileArchive, color: "text-amber-400 bg-amber-500/10" },
  other: { icon: FileIcon, color: "text-slate-400 bg-white/[0.06]" },
};

/** Files attached to a record: drop or choose to upload, click to open (or
 * download), owners and admins can delete. */
export async function DocumentsSection({
  entityType,
  entityId,
  redirectPath,
  documents,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  redirectPath: string;
  documents: { id: string; filename: string; size: number; mimeType: string; createdAt: Date }[];
}) {
  const session = await verifySession();
  const canDelete = hasRole(session, ["OWNER", "ADMIN"]);
  const uploadAction = uploadDocument.bind(null, entityType, entityId, redirectPath) as (
    state: DocumentUploadState,
    formData: FormData
  ) => Promise<DocumentUploadState>;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Documents</CardTitle>
        {documents.length > 0 && <span className="text-xs text-slate-500">{documents.length} file{documents.length === 1 ? "" : "s"}</span>}
      </CardHeader>
      <CardContent>
        {documents.length > 0 && (
          <ul className="mb-4 divide-y divide-white/[0.06] light:divide-slate-200">
            {documents.map((doc) => {
              const kind = KIND_ICON[fileKind(doc.mimeType, doc.filename)];
              const Icon = kind.icon;
              const opens = opensInBrowser(doc.mimeType);
              return (
                <li key={doc.id} className="group flex items-center gap-3 py-2.5 text-sm">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${kind.color}`} aria-hidden>
                    <Icon className="h-4 w-4" />
                  </span>
                  <a
                    href={`/api/documents/${doc.id}`}
                    {...(opens ? { target: "_blank", rel: "noopener noreferrer" } : { download: doc.filename })}
                    className="min-w-0 flex-1"
                    title={opens ? "Open" : "Download"}
                  >
                    <span className="block truncate font-medium text-slate-100 transition-colors group-hover:text-blue-400 light:text-slate-800">
                      {doc.filename}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {formatFileSize(doc.size)} · {doc.createdAt.toLocaleDateString()}
                    </span>
                  </a>
                  <a
                    href={`/api/documents/${doc.id}`}
                    download={doc.filename}
                    aria-label={`Download ${doc.filename}`}
                    className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200 light:hover:bg-slate-100 light:hover:text-slate-800"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  {canDelete && (
                    <DeleteButton action={deleteDocument.bind(null, doc.id, redirectPath)} confirmMessage={`Delete ${doc.filename}?`} label="" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {documents.length === 0 && (
          <p className="mb-3 text-sm text-slate-500">Keep contracts, receipts, photos and other files with this record.</p>
        )}
        <DocumentDropzone action={uploadAction} />
      </CardContent>
    </Card>
  );
}
