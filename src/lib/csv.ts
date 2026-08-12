/** Escapes a single CSV field per RFC 4180: wraps in quotes and doubles any
 * embedded quote whenever the value contains a comma, quote, or newline. */
function escapeCsvField(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: (string | number | Date | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  // CRLF per RFC 4180; a leading BOM keeps Excel from mis-detecting encoding
  // on accented characters (customer/company names in particular).
  return "﻿" + lines.join("\r\n") + "\r\n";
}
