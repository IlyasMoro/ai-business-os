/* Customer CSV import: reading the file, matching columns and checking each
   row before anything is saved. No database access here; the action passes
   in the emails already on file and the team's emails. */

import { LEAD_SOURCES, type LeadSource } from "@/lib/crm-pipeline";

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 1024 * 1024;

/** Reads CSV text per RFC 4180: quoted fields may hold commas, quotes ("")
 * and line breaks. Accepts CRLF or LF and ignores a leading BOM and blank
 * lines. Semicolon files (common from European Excel) are detected from the
 * header line. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export type ImportField = "name" | "email" | "phone" | "company" | "status" | "source" | "notes" | "creditLimit" | "owner";

/** Header names each field is recognised by, compared without case, spaces,
 * dashes or underscores. Covers this app's own export and common exports from
 * other CRMs. */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  name: ["name", "customer", "customername", "fullname", "contactname", "contact"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "telephone", "tel", "mobile", "cell"],
  company: ["company", "companyname", "organisation", "organization", "business", "account", "accountname"],
  status: ["status", "customerstatus", "lifecyclestage", "stage"],
  source: ["source", "leadsource", "origin", "channel"],
  notes: ["notes", "note", "comments", "description"],
  creditLimit: ["creditlimit", "credit"],
  owner: ["owner", "owneremail", "accountowner", "salesperson", "assignedto"],
};

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  status: "Status",
  source: "Lead source",
  notes: "Notes",
  creditLimit: "Credit limit",
  owner: "Owner email",
};

const squash = (s: string) => s.toLowerCase().replace(/[\s_\-.]/g, "");

/** Which column holds each field. Unrecognised columns are listed so the
 * preview can say they will be ignored. First and last name columns are
 * joined into the name when there is no name column. */
export function matchColumns(header: string[]) {
  const columns: Partial<Record<ImportField, number>> = {};
  const ignored: string[] = [];
  let first: number | undefined;
  let last: number | undefined;
  header.forEach((raw, index) => {
    const key = squash(raw);
    const field = (Object.keys(HEADER_ALIASES) as ImportField[]).find((f) => HEADER_ALIASES[f].includes(key));
    if (field && columns[field] === undefined) columns[field] = index;
    else if (["firstname", "givenname"].includes(key)) first = index;
    else if (["lastname", "surname", "familyname"].includes(key)) last = index;
    else if (raw.trim()) ignored.push(raw.trim());
  });
  return { columns, nameParts: columns.name === undefined ? { first, last } : {}, ignored };
}

export type CustomerStatusId = "LEAD" | "ACTIVE" | "INACTIVE";

const STATUS_WORDS: Record<string, CustomerStatusId> = {
  lead: "LEAD",
  prospect: "LEAD",
  new: "LEAD",
  active: "ACTIVE",
  customer: "ACTIVE",
  inactive: "INACTIVE",
  former: "INACTIVE",
  churned: "INACTIVE",
};

function parseSource(value: string): LeadSource | null {
  const key = squash(value);
  const match = LEAD_SOURCES.find((s) => squash(s.id) === key || squash(s.label) === key);
  if (match) return match.id;
  if (["social", "facebook", "instagram", "linkedin", "twitter"].includes(key)) return "SOCIAL";
  if (["web", "site", "online", "inbound"].includes(key)) return "WEBSITE";
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ImportCustomer = {
  line: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: CustomerStatusId;
  source: LeadSource | null;
  notes: string | null;
  creditLimit: number | null;
  /** A team member's id, or null to use the person importing. */
  ownerId: string | null;
};

export type ImportPlan = {
  ready: ImportCustomer[];
  /** Rows that can't be imported, with the reason. */
  problems: { line: number; message: string }[];
  /** Rows skipped because the email is already on file or earlier in the file. */
  duplicates: { line: number; name: string; email: string }[];
  /** Imported, but something was left out or changed. */
  warnings: { line: number; message: string }[];
  ignoredColumns: string[];
  /** A message when the whole file can't be used. */
  fatal?: string;
};

/**
 * Checks every row of a parsed CSV. `existingEmails` are the company's
 * customer emails, lowercased; `teamByEmail` maps team members' lowercased
 * emails to their ids. Line numbers count the header as line 1, as a
 * spreadsheet shows them.
 */
export function planImport(
  rows: string[][],
  { existingEmails, teamByEmail }: { existingEmails: Set<string>; teamByEmail: Map<string, string> }
): ImportPlan {
  const plan: ImportPlan = { ready: [], problems: [], duplicates: [], warnings: [], ignoredColumns: [] };
  if (rows.length === 0) return { ...plan, fatal: "The file is empty." };
  const [header, ...body] = rows;
  const { columns, nameParts, ignored } = matchColumns(header);
  plan.ignoredColumns = ignored;
  if (columns.name === undefined && nameParts.first === undefined && nameParts.last === undefined) {
    return { ...plan, fatal: "No name column found. The first row must be headings, with one called Name." };
  }
  if (body.length === 0) return { ...plan, fatal: "The file has headings but no customers." };
  if (body.length > MAX_IMPORT_ROWS) {
    return { ...plan, fatal: `The file has ${body.length} customers. Import at most ${MAX_IMPORT_ROWS} at a time.` };
  }

  const seen = new Set<string>();
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (field: ImportField) => {
      const index = columns[field];
      const value = index === undefined ? "" : (cells[index] ?? "").trim();
      return value;
    };
    const part = (index: number | undefined) => (index === undefined ? "" : (cells[index] ?? "").trim());
    const name = (get("name") || [part(nameParts.first), part(nameParts.last)].filter(Boolean).join(" ")).slice(0, 200);
    if (!name) {
      plan.problems.push({ line, message: "No name." });
      return;
    }

    const email = get("email").toLowerCase();
    if (email && !EMAIL_RE.test(email)) {
      plan.problems.push({ line, message: `"${email}" isn't a valid email address.` });
      return;
    }
    if (email && (existingEmails.has(email) || seen.has(email))) {
      plan.duplicates.push({ line, name, email });
      return;
    }
    if (email) seen.add(email);

    const statusText = get("status");
    const status = statusText ? STATUS_WORDS[squash(statusText)] : "LEAD";
    if (!status) plan.warnings.push({ line, message: `Status "${statusText}" isn't known, so it was set to Lead.` });

    const sourceText = get("source");
    const source = sourceText ? parseSource(sourceText) : null;
    if (sourceText && !source) plan.warnings.push({ line, message: `Lead source "${sourceText}" isn't known, so it was left empty.` });

    const creditText = get("creditLimit").replace(/[\s$,R€£]/g, "");
    let creditLimit: number | null = null;
    if (creditText) {
      const n = Number(creditText);
      if (Number.isFinite(n) && n >= 0) creditLimit = n;
      else plan.warnings.push({ line, message: `Credit limit "${get("creditLimit")}" isn't a number, so it was left empty.` });
    }

    const ownerText = get("owner").toLowerCase();
    const ownerId = ownerText ? (teamByEmail.get(ownerText) ?? null) : null;
    if (ownerText && !ownerId) plan.warnings.push({ line, message: `${ownerText} isn't on your team, so you were made the owner.` });

    plan.ready.push({
      line,
      name,
      email: email || null,
      phone: get("phone").slice(0, 50) || null,
      company: get("company").slice(0, 200) || null,
      status: status ?? "LEAD",
      source,
      notes: get("notes").slice(0, 5000) || null,
      creditLimit,
      ownerId,
    });
  });
  return plan;
}
