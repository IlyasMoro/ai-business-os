"use client";

import { useRef, useState, type DragEvent } from "react";
import { ImageUp, X } from "lucide-react";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { cn } from "@/lib/utils";

/* Must match the server's limits in lib/actions/company.ts. Invoices and
   payslips are PDFs, which can only hold PNG or JPEG, so other images are
   converted to PNG here before they are sent. */
const MAX_BYTES = 2 * 1024 * 1024;
const STORED_TYPES = ["image/png", "image/jpeg"];
const CONVERTIBLE_TYPES = ["image/webp", "image/gif", "image/svg+xml"];
/** Longest side when a picture has to be converted or shrunk; plenty for a document header. */
const MAX_SIDE = 1024;

const SERVER_ERRORS: Record<string, string> = {
  "logo-missing": "Choose a logo first.",
  "logo-type": "Use a PNG or JPEG image.",
  "logo-size": "The logo must be 2MB or smaller.",
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Redraws an image as a PNG no larger than MAX_SIDE, for WebP, GIF and SVG
 * logos and for PNG or JPEG files over the size limit. */
async function toPng(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || MAX_SIDE;
    const h = img.naturalHeight || MAX_SIDE;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("conversion failed");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The company logo picker on Settings: a drop zone, a preview of the chosen
 * image with its name and size before uploading, and problems explained on
 * the card itself rather than in a banner at the top of the page.
 */
export function LogoUpload({
  action,
  hasLogo,
  serverError,
}: {
  action: (formData: FormData) => Promise<void>;
  hasLogo: boolean;
  /** An error code from the last upload, e.g. "logo-type". */
  serverError?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ file: File; preview: string; converted: boolean } | null>(null);
  const [problem, setProblem] = useState<string | null>(serverError ? SERVER_ERRORS[serverError] ?? null : null);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);

  const clear = () => {
    if (chosen) URL.revokeObjectURL(chosen.preview);
    setChosen(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Checks, converts if needed, then puts the final file back into the
  // input so the form sends exactly what the preview shows.
  const take = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    const stored = STORED_TYPES.includes(file.type);
    if (!stored && !CONVERTIBLE_TYPES.includes(file.type)) {
      clear();
      setProblem("That file type can't be used. Choose a PNG or JPEG image (WebP, GIF and SVG are converted for you).");
      return;
    }
    let final = file;
    let converted = false;
    if (!stored || file.size > MAX_BYTES) {
      setWorking(true);
      try {
        final = await toPng(file);
        converted = true;
      } catch {
        clear();
        setProblem("That image couldn't be read. Try saving it as a PNG or JPEG first.");
        return;
      } finally {
        setWorking(false);
      }
    }
    if (final.size > MAX_BYTES) {
      clear();
      setProblem(`The logo must be 2MB or smaller; this one is ${formatSize(final.size)}.`);
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(final);
    if (inputRef.current) inputRef.current.files = dt.files;
    if (chosen) URL.revokeObjectURL(chosen.preview);
    setChosen({ file: final, preview: URL.createObjectURL(final), converted });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void take(e.dataTransfer.files[0]);
  };

  return (
    <form action={action} className="mt-4">
      <input
        ref={inputRef}
        id="logo"
        type="file"
        name="logo"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="sr-only"
        onChange={(e) => void take(e.target.files?.[0])}
      />

      {chosen ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.09] p-3 light:border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={chosen.preview} alt="Chosen logo" className="h-14 w-14 rounded-md bg-white object-contain p-1" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium text-slate-50 light:text-slate-900">{chosen.file.name}</p>
            <p className="text-slate-400 light:text-slate-500">
              {formatSize(chosen.file.size)}
              {chosen.converted && " · converted to PNG so it works on invoices and payslips"}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Choose a different file"
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="h-4 w-4" />
          </button>
          <SubmitButton pendingText="Uploading...">{hasLogo ? "Replace logo" : "Upload logo"}</SubmitButton>
        </div>
      ) : (
        <label
          htmlFor="logo"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500",
            dragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-white/15 hover:border-white/30 hover:bg-white/[0.03] light:border-slate-300 light:hover:border-slate-400"
          )}
        >
          <ImageUp aria-hidden className="h-6 w-6 text-slate-400" />
          <span className="text-sm text-slate-200 light:text-slate-700">
            {working ? (
              "Preparing your logo..."
            ) : (
              <>
                Drop your logo here or <span className="font-medium text-blue-400 light:text-blue-700">choose a file</span>
              </>
            )}
          </span>
          <span className="text-xs text-slate-500">PNG or JPEG up to 2MB. WebP, GIF and SVG are converted to PNG.</span>
        </label>
      )}

      {problem && (
        <p role="alert" className="mt-2 text-sm text-red-400 light:text-red-700">
          {problem}
        </p>
      )}
    </form>
  );
}
