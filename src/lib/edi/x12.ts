/**
 * Minimal ANSI X12 support: enough to build and read the envelopes
 * (ISA/GS/ST) and the handful of transaction sets this app exchanges.
 * Pure functions only, so every rule here is unit tested.
 */

export type X12Version = "004010" | "005010";
export const X12_VERSIONS: X12Version[] = ["004010", "005010"];

export type X12Format = {
  version: X12Version;
  usageIndicator: "T" | "P";
  elementSeparator: string;
  subElementSeparator: string;
  segmentTerminator: string;
};

export type X12Party = { qualifier: string; isaId: string; gsId: string };

export class X12Error extends Error {}

/** Separators must be single, distinct, non alphanumeric characters. */
export function validateSeparators(f: Pick<X12Format, "elementSeparator" | "subElementSeparator" | "segmentTerminator">) {
  const seps = [f.elementSeparator, f.subElementSeparator, f.segmentTerminator];
  if (seps.some((c) => c.length !== 1 || /[A-Za-z0-9\s]/.test(c))) {
    return "Separators must each be one symbol, not a letter, digit or space.";
  }
  if (new Set(seps).size !== 3) return "The three separators must all be different.";
  return null;
}

const pad = (value: string, width: number) => value.slice(0, width).padEnd(width, " ");
const zeroPad = (n: number, width: number) => String(n).padStart(width, "0").slice(-width);

function ymd(date: Date, century: boolean) {
  const y = String(date.getUTCFullYear());
  const md = zeroPad(date.getUTCMonth() + 1, 2) + zeroPad(date.getUTCDate(), 2);
  return (century ? y : y.slice(2)) + md;
}
const hm = (date: Date) => zeroPad(date.getUTCHours(), 2) + zeroPad(date.getUTCMinutes(), 2);

/** X12 has no escaping, so any separator inside a value is replaced. */
function clean(value: string | number, f: X12Format): string {
  let s = String(value);
  for (const sep of [f.elementSeparator, f.subElementSeparator, f.segmentTerminator, "\r", "\n"]) {
    s = s.split(sep).join(" ");
  }
  return s.trim();
}

/** Money and quantities without trailing zeros, as X12 "R" elements expect. */
export function x12Number(n: number): string {
  return String(Math.round(n * 10000) / 10000);
}

export type Segment = (string | number)[];

const FUNCTIONAL_IDS: Record<string, string> = { "850": "PO", "810": "IN", "856": "SH", "997": "FA" };

/**
 * Wraps one transaction set in ST/SE, GS/GE and ISA/IEA. The same control
 * number is used for the interchange and the group; the set is 0001.
 */
export function buildInterchange(opts: {
  format: X12Format;
  sender: X12Party;
  receiver: X12Party;
  transactionSet: string;
  segments: Segment[];
  controlNumber: number;
  date?: Date;
}): string {
  const { format: f, sender, receiver, transactionSet, segments, controlNumber } = opts;
  const date = opts.date ?? new Date();
  const e = f.elementSeparator;
  const seg = (s: Segment) => s.map((v, i) => (i === 0 ? String(v) : clean(v, f))).join(e) + f.segmentTerminator;
  const control9 = zeroPad(controlNumber, 9);
  const is5010 = f.version === "005010";

  const isa = [
    "ISA",
    "00",
    pad("", 10),
    "00",
    pad("", 10),
    pad(sender.qualifier, 2),
    pad(sender.isaId, 15),
    pad(receiver.qualifier, 2),
    pad(receiver.isaId, 15),
    ymd(date, false),
    hm(date),
    is5010 ? "^" : "U",
    is5010 ? "00501" : "00401",
    control9,
    "0",
    f.usageIndicator,
    f.subElementSeparator,
  ].join(e) + f.segmentTerminator;

  const body = [["ST", transactionSet, "0001"], ...segments];
  const lines = [
    isa,
    seg(["GS", FUNCTIONAL_IDS[transactionSet] ?? "ZZ", sender.gsId, receiver.gsId, ymd(date, true), hm(date), controlNumber, "X", f.version]),
    ...body.map(seg),
    seg(["SE", body.length + 1, "0001"]),
    seg(["GE", 1, controlNumber]),
    seg(["IEA", 1, control9]),
  ];
  return lines.join("\n");
}

export type ParsedSet = { type: string; controlNumber: string; segments: string[][] };
export type ParsedInterchange = {
  elementSeparator: string;
  subElementSeparator: string;
  segmentTerminator: string;
  sender: { qualifier: string; id: string };
  receiver: { qualifier: string; id: string };
  controlNumber: string;
  usageIndicator: string;
  groups: { functionalId: string; senderId: string; receiverId: string; controlNumber: string; version: string; sets: ParsedSet[] }[];
};

/**
 * Reads one interchange and checks its envelope: ISA is fixed width, and
 * every closing segment (SE, GE, IEA) must carry the right count and the
 * control number of the segment it closes.
 */
export function parseInterchange(raw: string): ParsedInterchange {
  const text = raw.replace(/^﻿/, "").trimStart();
  if (!text.startsWith("ISA")) throw new X12Error("The file doesn't start with an ISA segment, so it isn't an X12 interchange.");
  if (text.length < 106) throw new X12Error("The ISA segment is shorter than the 106 characters X12 requires.");

  const elementSeparator = text[3];
  const subElementSeparator = text[104];
  const segmentTerminator = text[105];
  if (new Set([elementSeparator, subElementSeparator, segmentTerminator]).size !== 3) {
    throw new X12Error("The ISA segment's separators aren't three different characters.");
  }

  const segments = text
    .split(segmentTerminator)
    .map((s) => s.replace(/[\r\n]/g, "").trim())
    .filter(Boolean)
    .map((s) => s.split(elementSeparator));

  const isa = segments[0];
  if (isa.length < 17) throw new X12Error("The ISA segment is missing elements.");
  const iea = segments[segments.length - 1];
  if (iea[0] !== "IEA") throw new X12Error("The interchange isn't closed with an IEA segment.");
  if (iea[2]?.trim() !== isa[13].trim()) throw new X12Error("The IEA control number doesn't match the ISA control number.");

  const groups: ParsedInterchange["groups"] = [];
  let i = 1;
  while (i < segments.length - 1) {
    const gs = segments[i];
    if (gs[0] !== "GS") throw new X12Error(`Expected a GS segment but found ${gs[0]}.`);
    const group = { functionalId: gs[1], senderId: gs[2], receiverId: gs[3], controlNumber: gs[6], version: gs[8], sets: [] as ParsedSet[] };
    i++;
    while (i < segments.length - 1 && segments[i][0] === "ST") {
      const st = segments[i];
      const start = i;
      while (i < segments.length - 1 && segments[i][0] !== "SE") i++;
      const se = segments[i];
      if (!se || se[0] !== "SE") throw new X12Error(`Transaction set ${st[2]} isn't closed with an SE segment.`);
      if (Number(se[1]) !== i - start + 1) {
        throw new X12Error(`Transaction set ${st[2]} says it has ${se[1]} segments but has ${i - start + 1}.`);
      }
      if (se[2] !== st[2]) throw new X12Error(`The SE control number doesn't match ST ${st[2]}.`);
      group.sets.push({ type: st[1], controlNumber: st[2], segments: segments.slice(start + 1, i) });
      i++;
    }
    const ge = segments[i];
    if (!ge || ge[0] !== "GE") throw new X12Error("A functional group isn't closed with a GE segment.");
    if (Number(ge[1]) !== group.sets.length) throw new X12Error(`The GE segment counts ${ge[1]} sets but the group has ${group.sets.length}.`);
    if (ge[2] !== group.controlNumber) throw new X12Error("The GE control number doesn't match its GS segment.");
    groups.push(group);
    i++;
  }
  if (Number(iea[1]) !== groups.length) throw new X12Error(`The IEA segment counts ${iea[1]} groups but there are ${groups.length}.`);

  return {
    elementSeparator,
    subElementSeparator,
    segmentTerminator,
    sender: { qualifier: isa[5].trim(), id: isa[6].trim() },
    receiver: { qualifier: isa[7].trim(), id: isa[8].trim() },
    controlNumber: isa[13].trim(),
    usageIndicator: isa[15].trim(),
    groups,
  };
}

// ---------- Transaction sets ----------

export type EdiLine = { sku: string; description?: string; quantity: number; unitPrice: number };

/** 850 Purchase Order, sent to a supplier. */
export function segments850(po: { number: string; date: Date; expectedDate?: Date | null; buyerName: string; sellerName: string; lines: EdiLine[] }): Segment[] {
  return [
    ["BEG", "00", "SA", po.number, "", ymd(po.date, true)],
    ...(po.expectedDate ? [["DTM", "002", ymd(po.expectedDate, true)]] : []),
    ["N1", "BY", po.buyerName],
    ["N1", "SE", po.sellerName],
    ...po.lines.map((l, i) => ["PO1", i + 1, l.quantity, "EA", x12Number(l.unitPrice), "", "VP", l.sku]),
    ["CTT", po.lines.length],
  ];
}

/** 810 Invoice, sent to a customer. TDS is the total in cents. */
export function segments810(inv: { number: string; date: Date; poNumber?: string | null; billTo: string; total: number; lines: EdiLine[] }): Segment[] {
  return [
    ["BIG", ymd(inv.date, true), inv.number, "", inv.poNumber ?? ""],
    ["N1", "BT", inv.billTo],
    ...inv.lines.map((l, i) => ["IT1", i + 1, l.quantity, "EA", x12Number(l.unitPrice), "", "VP", l.sku]),
    ["TDS", Math.round(inv.total * 100)],
    ["CTT", inv.lines.length],
  ];
}

/** 856 Ship Notice: shipment, then order, then one item level per line. */
export function segments856(ship: { shipmentId: string; date: Date; orderNumber: string; poNumber?: string | null; lines: EdiLine[] }): Segment[] {
  const segs: Segment[] = [
    ["BSN", "00", ship.shipmentId, ymd(ship.date, true), hm(ship.date)],
    ["HL", 1, "", "S"],
    ["HL", 2, 1, "O"],
    ["PRF", ship.poNumber || ship.orderNumber],
  ];
  ship.lines.forEach((l, i) => {
    segs.push(["HL", i + 3, 2, "I"], ["LIN", "", "VP", l.sku], ["SN1", "", l.quantity, "EA"]);
  });
  segs.push(["CTT", ship.lines.length + 2]);
  return segs;
}

/** 997 Functional Acknowledgment for one received group. */
export function segments997(ack: { functionalId: string; groupControlNumber: string; setType: string; setControlNumber: string; accepted: boolean }): Segment[] {
  const code = ack.accepted ? "A" : "R";
  return [
    ["AK1", ack.functionalId, ack.groupControlNumber],
    ["AK2", ack.setType, ack.setControlNumber],
    ["AK5", code],
    ["AK9", code, 1, 1, ack.accepted ? 1 : 0],
  ];
}

export type Parsed850 = {
  poNumber: string;
  poDate: string | null;
  lines: { lineNumber: string; quantity: number; unitPrice: number | null; productIds: Record<string, string> }[];
};

/** Reads the parts of an inbound 850 this app uses. */
export function read850(set: ParsedSet): Parsed850 {
  if (set.type !== "850") throw new X12Error(`Expected an 850 purchase order but got a ${set.type}.`);
  const beg = set.segments.find((s) => s[0] === "BEG");
  if (!beg || !beg[3]) throw new X12Error("The 850 has no BEG segment with a purchase order number.");

  const lines = set.segments
    .filter((s) => s[0] === "PO1")
    .map((s) => {
      const quantity = Number(s[2]);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
        throw new X12Error(`Line ${s[1] || "?"} has an invalid quantity "${s[2] ?? ""}".`);
      }
      const price = s[4] ? Number(s[4]) : null;
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        throw new X12Error(`Line ${s[1] || "?"} has an invalid unit price "${s[4]}".`);
      }
      // Product IDs come as qualifier and value pairs from PO106 onward.
      const productIds: Record<string, string> = {};
      for (let j = 6; j + 1 < s.length; j += 2) {
        if (s[j] && s[j + 1]) productIds[s[j]] = s[j + 1];
      }
      return { lineNumber: s[1] ?? "", quantity, unitPrice: price, productIds };
    });
  if (lines.length === 0) throw new X12Error("The 850 has no PO1 line items.");

  return { poNumber: beg[3], poDate: beg[5] || null, lines };
}

/** The SKU to match on: our part number first, then the buyer's, then any. */
export function pickSku(productIds: Record<string, string>): string | null {
  return productIds.VP ?? productIds.SK ?? productIds.BP ?? Object.values(productIds)[0] ?? null;
}
