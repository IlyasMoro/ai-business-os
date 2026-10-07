"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_DOCUMENTS_PER_UPLOAD, uploadBlocker } from "@/lib/document-files";
import type { DocumentUploadState } from "@/lib/actions/documents";

/**
 * Drop files here or click to choose; the upload starts straight away, no
 * extra button. Size and count are checked before anything is sent, and the
 * result shows right under the box.
 */
export function DocumentDropzone({
  action,
}: {
  action: (state: DocumentUploadState, formData: FormData) => Promise<DocumentUploadState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sending, setSending] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(list: FileList | null) {
    const files = Array.from(list ?? []);
    const blocker = uploadBlocker(files);
    setLocalError(blocker);
    if (blocker) return;
    setSending(files.map((f) => f.name));
    const data = new FormData();
    for (const f of files) data.append("file", f);
    startTransition(() => formAction(data));
    if (inputRef.current) inputRef.current.value = "";
  }

  const message = localError ?? (!pending && state?.error) ?? null;
  const done = !pending && !localError && state?.ok;

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!pending) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!pending) upload(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-blue-500",
          dragging
            ? "border-blue-400 bg-blue-500/10 light:bg-blue-50"
            : "border-white/15 hover:border-white/30 hover:bg-white/[0.03] light:border-slate-300 light:hover:border-slate-400 light:hover:bg-slate-50",
          pending && "pointer-events-none opacity-70"
        )}
      >
        {pending ? (
          <Loader2 className="h-6 w-6 animate-spin text-blue-400 light:text-blue-700" aria-hidden />
        ) : (
          <UploadCloud className={cn("h-6 w-6", dragging ? "text-blue-400" : "text-slate-500")} aria-hidden />
        )}
        <span className="text-sm text-slate-200 light:text-slate-800">
          {pending ? (
            `Uploading ${sending.length === 1 ? sending[0] : `${sending.length} files`}...`
          ) : (
            <>
              <span className="font-medium text-blue-400 light:text-blue-700">Choose files</span> or drop them here
            </>
          )}
        </span>
        <span className="text-xs text-slate-500">Up to {MAX_DOCUMENTS_PER_UPLOAD} files at once, 8 MB each. PDFs, images, office files and more.</span>
        <input
          ref={inputRef}
          type="file"
          name="file"
          multiple
          disabled={pending}
          className="sr-only"
          onChange={(e) => upload(e.currentTarget.files)}
        />
      </label>
      <p aria-live="polite" className="mt-2 min-h-5 text-sm">
        {message && <span className="text-red-400 light:text-red-700">{message}</span>}
        {done && (
          <span className="text-emerald-400 light:text-emerald-700">
            {state!.ok === 1 ? "File uploaded." : `${state!.ok} files uploaded.`}
          </span>
        )}
      </p>
    </div>
  );
}
