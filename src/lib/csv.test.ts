import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("joins headers and rows with commas and CRLF, with a leading BOM", () => {
    const csv = toCsv(["Name", "Amount"], [["Acme", 100]]);
    expect(csv).toBe("﻿Name,Amount\r\nAcme,100\r\n");
  });

  it("quotes and escapes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv(["Note"], [['Say "hi", then go\nhome']]);
    expect(csv).toContain('"Say ""hi"", then go\nhome"');
  });

  it("renders null and undefined as empty fields", () => {
    const csv = toCsv(["A", "B"], [[null, undefined]]);
    expect(csv).toBe("﻿A,B\r\n,\r\n");
  });

  it("serializes Date values as ISO strings", () => {
    const date = new Date("2026-01-15T00:00:00.000Z");
    const csv = toCsv(["Date"], [[date]]);
    expect(csv).toContain("2026-01-15T00:00:00.000Z");
  });
});
