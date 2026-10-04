/* The company's own customer fields (CustomField): reading their values from
   a form, checking them and showing them. Values live in Customer.customFields
   as { [fieldId]: string | number }. No database access here. */

export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT";

export type CustomFieldDef = { id: string; label: string; type: CustomFieldType; options: string[] };

export type CustomValues = Record<string, string | number>;

export const CUSTOM_FIELD_TYPES: { id: CustomFieldType; label: string }[] = [
  { id: "TEXT", label: "Text" },
  { id: "NUMBER", label: "Number" },
  { id: "DATE", label: "Date" },
  { id: "SELECT", label: "Dropdown list" },
];

export const MAX_CUSTOM_FIELDS = 20;
export const MAX_FIELD_OPTIONS = 30;
const MAX_TEXT = 500;

/** The form input name for a field. */
export const fieldInputName = (fieldId: string) => `cf_${fieldId}`;

/** Dropdown choices typed one per line (or comma separated): trimmed, blank
 * and repeated ones dropped. */
export function parseOptions(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,]/)) {
    const option = part.trim().slice(0, 80);
    if (!option || seen.has(option.toLowerCase())) continue;
    seen.add(option.toLowerCase());
    out.push(option);
    if (out.length >= MAX_FIELD_OPTIONS) break;
  }
  return out;
}

/**
 * Reads every field's value from a submitted customer form. Blank inputs are
 * left out. Returns the field labels that hold something invalid (a number
 * that isn't one, a date that isn't real, a choice not on the list).
 */
export function readCustomValues(
  fields: CustomFieldDef[],
  get: (name: string) => string | null
): { values: CustomValues; invalid: string[] } {
  const values: CustomValues = {};
  const invalid: string[] = [];
  for (const field of fields) {
    const raw = (get(fieldInputName(field.id)) ?? "").trim();
    if (!raw) continue;
    switch (field.type) {
      case "NUMBER": {
        const n = Number(raw);
        if (Number.isFinite(n)) values[field.id] = n;
        else invalid.push(field.label);
        break;
      }
      case "DATE": {
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime())) values[field.id] = raw;
        else invalid.push(field.label);
        break;
      }
      case "SELECT": {
        if (field.options.includes(raw)) values[field.id] = raw;
        else invalid.push(field.label);
        break;
      }
      default:
        values[field.id] = raw.slice(0, MAX_TEXT);
    }
  }
  return { values, invalid };
}

/** The stored JSON as values, ignoring anything that isn't a string or number. */
export function asCustomValues(json: unknown): CustomValues {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: CustomValues = {};
  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "number") out[key] = value;
  }
  return out;
}

/** A value as people read it: dates as "12 Mar 2026", numbers grouped. */
export function formatCustomValue(field: CustomFieldDef, value: string | number | undefined): string | null {
  if (value === undefined || value === "") return null;
  if (field.type === "NUMBER" && typeof value === "number") return value.toLocaleString("en-US");
  if (field.type === "DATE" && typeof value === "string") {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  return String(value);
}
