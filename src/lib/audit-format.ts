/* Turns stored audit log rows into readable lines for the activity feed:
   IDs become names, keys get labels, and each row links to its record.
   Pure, so it can be unit tested; the Reports page supplies the lookups. */

/** "transfer.approved_and_sent" → "Transfer approved and sent". */
export function formatAuditAction(action: string): string {
  const readable = action.replace(/[._]/g, " ");
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

const KEY_LABELS: Record<string, string> = {
  branchId: "Branch",
  code: "Code",
  lines: "Lines",
  from: "From",
  to: "To",
  status: "Status",
  lots: "Lots",
  fiscalYear: "Fiscal year",
};

function humanise(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._]/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Keys whose values are statuses or modes rather than codes the user typed. */
const ENUM_KEYS = new Set(["status", "from", "to"]);

function readableValue(value: unknown, names: Map<string, string>, key = ""): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    if (names.has(value)) return names.get(value)!;
    // Status style values: "ON_HOLD" → "on hold". Codes like "CPT" stay as typed.
    if (/^[A-Z][A-Z_]+$/.test(value) && (ENUM_KEYS.has(key) || value.includes("_"))) {
      return value.replace(/_/g, " ").toLowerCase();
    }
    return value;
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/**
 * The details column. `names` maps record IDs (branches, for now) to
 * their names, so "from: cm…, to: cm…" reads "From Main branch to Cape Town".
 */
export function formatAuditDetails(metadata: string | null, names: Map<string, string> = new Map()): string | null {
  if (!metadata) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
  const entries = { ...parsed };
  const parts: string[] = [];

  // A route reads best as one phrase.
  const from = readableValue(entries.from, names, "from");
  const to = readableValue(entries.to, names, "to");
  if (from && to) {
    parts.push(`From ${from} to ${to}`);
    delete entries.from;
    delete entries.to;
  }

  for (const [key, raw] of Object.entries(entries)) {
    const value = readableValue(raw, names, key);
    // A branch access change to null means every branch.
    if (value === null && key === "branchId" && "branchId" in parsed) {
      parts.push("Branch: all branches");
      continue;
    }
    if (value === null) continue;
    parts.push(`${KEY_LABELS[key] ?? humanise(key)}: ${value}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

const ENTITY_PATHS: Record<string, string> = {
  StockTransfer: "/dashboard/transfers",
  Invoice: "/dashboard/invoicing",
  PurchaseOrder: "/dashboard/procurement",
  Product: "/dashboard/inventory",
  Employee: "/dashboard/hr",
  CostCenter: "/dashboard/controlling/cost-centers",
  InternalOrder: "/dashboard/controlling/orders",
  ReturnAuthorization: "/dashboard/returns",
  WorkOrder: "/dashboard/mrp/work-orders",
  PayrollRun: "/dashboard/payroll",
  Order: "/dashboard/sales",
  Customer: "/dashboard/crm",
};

/** Where an activity row should link, or null when its record has no page. */
export function auditHref(entityType: string, entityId: string): string | null {
  if (entityType === "Branch") return "/dashboard/branches";
  const base = ENTITY_PATHS[entityType];
  return base && entityId ? `${base}/${entityId}` : null;
}
