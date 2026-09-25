export const DOC_TYPE_LABEL: Record<string, string> = {
  "850": "Purchase order",
  "810": "Invoice",
  "856": "Ship notice",
  "997": "Acknowledgment",
  unknown: "Unreadable file",
};

/**
 * One segment per line for display. Uses the file's own terminator (the
 * character right after ISA16) and falls back to "~" for unreadable files.
 */
export function prettyX12(content: string): string {
  const flat = content.replace(/\r?\n/g, "");
  const terminator = flat.startsWith("ISA") && flat.length > 105 ? flat[105] : "~";
  return flat.split(terminator).filter(Boolean).map((s) => s + terminator).join("\n");
}
