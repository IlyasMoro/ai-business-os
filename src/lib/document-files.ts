/* Rules for attached documents, shared by the upload form, the upload
   action, the download route and tests. No database access here. */

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_UPLOAD = 10;

/** Types that are safe to open in the browser tab. Everything else (HTML,
 * SVG, scripts, office files...) downloads instead, so an uploaded file can
 * never run as a page inside the app. */
const INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"]);

export function opensInBrowser(mimeType: string): boolean {
  return INLINE_TYPES.has(mimeType.toLowerCase().split(";")[0].trim());
}

/** Content-Disposition with a safe ASCII fallback and the real (UTF-8) name. */
export function contentDisposition(mimeType: string, filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "document";
  return `${opensInBrowser(mimeType) ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export type FileKind = "pdf" | "image" | "sheet" | "doc" | "archive" | "other";

/** Which icon to show, from the type and, failing that, the file extension. */
export function fileKind(mimeType: string, filename: string): FileKind {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const mime = mimeType.toLowerCase();
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return "image";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv" || ["xls", "xlsx", "csv", "ods"].includes(ext)) return "sheet";
  if (mime.includes("word") || mime.includes("document") || mime === "text/plain" || ["doc", "docx", "odt", "txt", "rtf"].includes(ext)) return "doc";
  if (mime.includes("zip") || mime.includes("compressed") || ["zip", "rar", "7z", "gz"].includes(ext)) return "archive";
  return "other";
}

/** Why the chosen files can't be uploaded, or null. */
export function uploadBlocker(files: { name: string; size: number }[]): string | null {
  if (files.length === 0) return "Choose a file to upload.";
  if (files.length > MAX_DOCUMENTS_PER_UPLOAD) return `Upload up to ${MAX_DOCUMENTS_PER_UPLOAD} files at a time.`;
  const empty = files.find((f) => f.size === 0);
  if (empty) return `${empty.name} is empty.`;
  const big = files.find((f) => f.size > MAX_DOCUMENT_BYTES);
  if (big) return `${big.name} is larger than 8 MB.`;
  return null;
}
