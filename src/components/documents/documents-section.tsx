import { FileArchive, FileImage, FileSpreadsheet, FileText, File as FileIcon, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { formatFileSize, formatDate } from "@/lib/utils";
import { uploadDocument, deleteDocument, type DocumentUploadState } from "@/lib/actions/documents";
import { verifySession, hasRole } from "@/lib/dal";
import { fileKind, opensInBrowser, type FileKind } from "@/lib/document-files";
import { DocumentDropzone } from "@/components/documents/document-dropzone";
import type { DocumentEntityType } from "@/generated/prisma/client";

// One neutral chip for every file type; the icon shape tells them apart.
const FILE_CHIP = "text-slate-300 bg-white/[0.06] light:text-slate-600 light:bg-slate-100";

const KIND_ICON: Record<FileKind, { icon: typeof FileText; color: string }> = {
  pdf: { icon: FileText, color: FILE_CHIP },
  image: { icon: FileImage, color: FILE_CHIP },
  sheet: { icon: FileSpreadsheet, color: FILE_CHIP },
  doc: { icon: FileText, color: FILE_CHIP },
  archive: { icon: FileArchive, color: FILE_CHIP },
  other: { icon: FileIcon, color: FILE_CHIP },
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
                      {formatFileSize(doc.size)} · {formatDate(doc.createdAt)}
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
