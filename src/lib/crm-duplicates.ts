/* Finding customers that are probably the same person or business, and
   working out what the merged record keeps. No database access here. */

export type DuplicateCandidate = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type DuplicateReason = "email" | "phone" | "name";

export const REASON_LABELS: Record<DuplicateReason, string> = {
  email: "Same email",
  phone: "Same phone",
  name: "Same name",
};

export type DuplicateGroup = { key: string; ids: string[]; reasons: DuplicateReason[] };

export function normalizeEmail(email: string | null): string | null {
  const e = email?.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}

/** The last 9 digits, so "+27 82 123 4567" and "082 123 4567" match.
 * Numbers shorter than 7 digits are too vague to compare. */
export function normalizePhone(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 7 ? digits.slice(-9) : null;
}

const NAME_NOISE = new Set(["the", "pty", "ltd", "limited", "inc", "llc", "cc", "co", "corp", "company", "and"]);

/** Lowercase words without punctuation or company endings, sorted, so
 * "Smith, John" and "john smith" match and so do "Acme (Pty) Ltd" and "ACME". */
export function normalizeName(name: string): string | null {
  const words = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !NAME_NOISE.has(w))
    .sort();
  const key = words.join(" ");
  return key.length >= 4 ? key : null;
}

/** The same group always gets the same key, whatever order it was found in. */
export const groupKey = (ids: string[]) => [...ids].sort().join(":");

/**
 * Groups customers sharing an email, a phone number or a name. Links chain:
 * if A and B share an email and B and C a phone, all three are one group.
 * Groups someone marked as not duplicates (`dismissed` keys) are left out.
 */
export function findDuplicateGroups(customers: DuplicateCandidate[], dismissed: Set<string> = new Set()): DuplicateGroup[] {
  const parent = new Map<string, string>(customers.map((c) => [c.id, c.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const reasonsByRoot = new Map<string, Set<DuplicateReason>>();
  const pairReasons: [string, string, DuplicateReason][] = [];

  const link = (reason: DuplicateReason, keyOf: (c: DuplicateCandidate) => string | null) => {
    const firstWithKey = new Map<string, string>();
    for (const c of customers) {
      const key = keyOf(c);
      if (!key) continue;
      const first = firstWithKey.get(key);
      if (first) {
        parent.set(find(c.id), find(first));
        pairReasons.push([first, c.id, reason]);
      } else firstWithKey.set(key, c.id);
    }
  };
  link("email", (c) => normalizeEmail(c.email));
  link("phone", (c) => normalizePhone(c.phone));
  link("name", (c) => normalizeName(c.name));

  for (const [a, , reason] of pairReasons) {
    const root = find(a);
    if (!reasonsByRoot.has(root)) reasonsByRoot.set(root, new Set());
    reasonsByRoot.get(root)!.add(reason);
  }

  const members = new Map<string, string[]>();
  for (const c of customers) {
    const root = find(c.id);
    if (!members.has(root)) members.set(root, []);
    members.get(root)!.push(c.id);
  }

  const order: DuplicateReason[] = ["email", "phone", "name"];
  const groups: DuplicateGroup[] = [];
  for (const [root, ids] of members) {
    if (ids.length < 2) continue;
    const key = groupKey(ids);
    if (dismissed.has(key)) continue;
    groups.push({ key, ids, reasons: order.filter((r) => reasonsByRoot.get(root)?.has(r)) });
  }
  // Strongest matches first: an email match is surer than a name match.
  return groups.sort((a, b) => order.indexOf(a.reasons[0]) - order.indexOf(b.reasons[0]) || b.ids.length - a.ids.length);
}

type Status = "LEAD" | "ACTIVE" | "INACTIVE";

export type MergeFields = {
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  status: Status;
  source: string | null;
  ownerId: string | null;
  campaignId: string | null;
  creditLimit: number | null;
  customFields: Record<string, string | number>;
  emailOptOut: boolean;
};

/**
 * What the kept customer looks like after a merge: its own details win, and
 * blanks are filled from the others in the order given. Notes are joined.
 * Active beats lead beats inactive, and an unsubscribe is never lost.
 */
export function mergeCustomerFields(keep: MergeFields, others: MergeFields[]): MergeFields {
  const fill = <K extends keyof MergeFields>(key: K): MergeFields[K] => {
    if (keep[key] !== null && keep[key] !== "") return keep[key];
    for (const other of others) if (other[key] !== null && other[key] !== "") return other[key];
    return keep[key];
  };
  const rank: Record<Status, number> = { ACTIVE: 2, LEAD: 1, INACTIVE: 0 };
  const status = [keep, ...others].map((c) => c.status).reduce((best, s) => (rank[s] > rank[best] ? s : best));

  const notes = [...new Set([keep, ...others].map((c) => c.notes?.trim()).filter((n): n is string => Boolean(n)))];
  const customFields = { ...keep.customFields };
  for (const other of others) {
    for (const [k, v] of Object.entries(other.customFields)) if (customFields[k] === undefined) customFields[k] = v;
  }

  return {
    email: fill("email"),
    phone: fill("phone"),
    company: fill("company"),
    source: fill("source"),
    ownerId: fill("ownerId"),
    campaignId: fill("campaignId"),
    creditLimit: fill("creditLimit"),
    notes: notes.length ? notes.join("\n\n") : null,
    status,
    customFields,
    emailOptOut: [keep, ...others].some((c) => c.emailOptOut),
  };
}
