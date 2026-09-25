import { describe, it, expect } from "vitest";
import {
  X12Error,
  buildInterchange,
  parseInterchange,
  pickSku,
  read850,
  segments810,
  segments850,
  segments856,
  segments997,
  validateSeparators,
  x12Number,
  type X12Format,
} from "@/lib/edi/x12";
import { prettyX12 } from "@/lib/edi/labels";

const format: X12Format = {
  version: "004010",
  usageIndicator: "T",
  elementSeparator: "*",
  subElementSeparator: ">",
  segmentTerminator: "~",
};
const us = { qualifier: "ZZ", isaId: "AIBOSDEMO", gsId: "AIBOSDEMO" };
const them = { qualifier: "ZZ", isaId: "ACMEBUYER", gsId: "ACMEBUYER" };
const date = new Date("2026-09-24T19:30:00Z");

function po850(lines = [{ sku: "WID1", quantity: 5, unitPrice: 12.5 }]) {
  return buildInterchange({
    format,
    sender: them,
    receiver: us,
    transactionSet: "850",
    controlNumber: 42,
    date,
    segments: segments850({ number: "PO7788", date, buyerName: "Acme", sellerName: "Us", lines }),
  });
}

describe("buildInterchange", () => {
  it("writes a fixed width ISA of exactly 106 characters", () => {
    const isa = po850().split("\n")[0];
    expect(isa).toHaveLength(106);
    expect(isa).toBe("ISA*00*          *00*          *ZZ*ACMEBUYER      *ZZ*AIBOSDEMO      *260924*1930*U*00401*000000042*0*T*>~");
  });

  it("closes every envelope with matching counts and control numbers", () => {
    const lines = po850().split("\n");
    expect(lines[1]).toBe("GS*PO*ACMEBUYER*AIBOSDEMO*20260924*1930*42*X*004010~");
    expect(lines[2]).toBe("ST*850*0001~");
    // ST, BEG, N1, N1, PO1, CTT, SE = 7
    expect(lines.at(-3)).toBe("SE*7*0001~");
    expect(lines.at(-2)).toBe("GE*1*42~");
    expect(lines.at(-1)).toBe("IEA*1*000000042~");
  });

  it("uses 5010 envelope values when configured", () => {
    const isa = buildInterchange({ format: { ...format, version: "005010" }, sender: us, receiver: them, transactionSet: "997", controlNumber: 1, date, segments: [] }).split("\n")[0];
    expect(isa).toContain("*^*00501*");
  });

  it("strips separators out of values so they can't break the file", () => {
    const text = buildInterchange({
      format,
      sender: us,
      receiver: them,
      transactionSet: "850",
      controlNumber: 1,
      date,
      segments: segments850({ number: "P*1~X", date, buyerName: "A~B*C", sellerName: "S", lines: [{ sku: "K", quantity: 1, unitPrice: 1 }] }),
    });
    expect(text).toContain("BEG*00*SA*P 1 X**20260924~");
    expect(text).toContain("N1*BY*A B C~");
  });
});

describe("parseInterchange", () => {
  it("round trips what buildInterchange writes", () => {
    const parsed = parseInterchange(po850());
    expect(parsed.sender).toEqual({ qualifier: "ZZ", id: "ACMEBUYER" });
    expect(parsed.receiver).toEqual({ qualifier: "ZZ", id: "AIBOSDEMO" });
    expect(parsed.controlNumber).toBe("000000042");
    expect(parsed.groups[0].sets[0].type).toBe("850");
  });

  it("reads separators from the ISA, whatever they are", () => {
    const text = buildInterchange({
      format: { ...format, elementSeparator: "|", subElementSeparator: "^", segmentTerminator: "!" },
      sender: them,
      receiver: us,
      transactionSet: "850",
      controlNumber: 3,
      date,
      segments: segments850({ number: "X1", date, buyerName: "A", sellerName: "B", lines: [{ sku: "K", quantity: 2, unitPrice: 3 }] }),
    });
    const parsed = parseInterchange(text);
    expect(parsed.elementSeparator).toBe("|");
    expect(read850(parsed.groups[0].sets[0]).poNumber).toBe("X1");
  });

  it("rejects files that aren't X12", () => {
    expect(() => parseInterchange("hello")).toThrow(X12Error);
  });

  it("rejects a wrong SE segment count", () => {
    expect(() => parseInterchange(po850().replace("SE*7*0001", "SE*9*0001"))).toThrow(/says it has 9 segments but has 7/);
  });

  it("rejects mismatched control numbers", () => {
    expect(() => parseInterchange(po850().replace("IEA*1*000000042", "IEA*1*000000043"))).toThrow(/IEA control number/);
    expect(() => parseInterchange(po850().replace("GE*1*42", "GE*1*41"))).toThrow(/GE control number/);
  });
});

describe("read850", () => {
  it("reads the PO number, quantities, prices and product IDs", () => {
    const set = parseInterchange(po850([{ sku: "WID1", quantity: 5, unitPrice: 12.5 }, { sku: "GAD2", quantity: 1, unitPrice: 3 }])).groups[0].sets[0];
    expect(read850(set)).toEqual({
      poNumber: "PO7788",
      poDate: "20260924",
      lines: [
        { lineNumber: "1", quantity: 5, unitPrice: 12.5, productIds: { VP: "WID1" } },
        { lineNumber: "2", quantity: 1, unitPrice: 3, productIds: { VP: "GAD2" } },
      ],
    });
  });

  it("rejects fractional or negative quantities", () => {
    const text = po850().replace("PO1*1*5*", "PO1*1*2.5*");
    expect(() => read850(parseInterchange(text).groups[0].sets[0])).toThrow(/invalid quantity/);
  });
});

describe("pickSku", () => {
  it("prefers our part number, then SKU, then the buyer's", () => {
    expect(pickSku({ BP: "B", VP: "V" })).toBe("V");
    expect(pickSku({ BP: "B", SK: "S" })).toBe("S");
    expect(pickSku({ BP: "B" })).toBe("B");
    expect(pickSku({})).toBeNull();
  });
});

describe("other transaction sets", () => {
  it("810 carries the total in cents and the customer PO", () => {
    const segs = segments810({ number: "INV0001", date, poNumber: "PO7788", billTo: "Acme", total: 62.5, lines: [{ sku: "WID1", quantity: 5, unitPrice: 12.5 }] });
    expect(segs[0]).toEqual(["BIG", "20260924", "INV0001", "", "PO7788"]);
    expect(segs).toContainEqual(["TDS", 6250]);
  });

  it("856 nests shipment, order and item levels", () => {
    const segs = segments856({ shipmentId: "SH1", date, orderNumber: "SO1", poNumber: "PO7788", lines: [{ sku: "A", quantity: 2, unitPrice: 1 }, { sku: "B", quantity: 1, unitPrice: 1 }] });
    const hls = segs.filter((s) => s[0] === "HL");
    expect(hls).toEqual([["HL", 1, "", "S"], ["HL", 2, 1, "O"], ["HL", 3, 2, "I"], ["HL", 4, 2, "I"]]);
    expect(segs).toContainEqual(["PRF", "PO7788"]);
  });

  it("997 accepts or rejects", () => {
    const base = { functionalId: "PO", groupControlNumber: "42", setType: "850", setControlNumber: "0001" };
    expect(segments997({ ...base, accepted: true }).at(-1)).toEqual(["AK9", "A", 1, 1, 1]);
    expect(segments997({ ...base, accepted: false }).at(-1)).toEqual(["AK9", "R", 1, 1, 0]);
  });
});

describe("helpers", () => {
  it("validates separators", () => {
    expect(validateSeparators({ elementSeparator: "*", subElementSeparator: ">", segmentTerminator: "~" })).toBeNull();
    expect(validateSeparators({ elementSeparator: "*", subElementSeparator: "*", segmentTerminator: "~" })).toMatch(/different/);
    expect(validateSeparators({ elementSeparator: "A", subElementSeparator: ">", segmentTerminator: "~" })).toMatch(/letter/);
  });

  it("formats numbers without trailing zeros", () => {
    expect(x12Number(12.5)).toBe("12.5");
    expect(x12Number(3)).toBe("3");
    expect(x12Number(0.1 + 0.2)).toBe("0.3");
  });

  it("pretty prints one segment per line using the file's own terminator", () => {
    const pretty = prettyX12(po850().replace(/~/g, "!").replace("*>!", "*>!"));
    expect(pretty.split("\n")[1]).toMatch(/^GS\*/);
  });
});
