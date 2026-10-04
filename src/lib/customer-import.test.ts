import { describe, expect, it } from "vitest";
import { matchColumns, parseCsv, planImport } from "@/lib/customer-import";
import { toCsv } from "@/lib/csv";

const none = { existingEmails: new Set<string>(), teamByEmail: new Map<string, string>() };

describe("parseCsv", () => {
  it("reads quoted fields with commas, quotes and line breaks", () => {
    const rows = parseCsv('Name,Notes\r\n"Acme, Inc","Said ""hi""\nthen left"\r\nBeta,\r\n');
    expect(rows).toEqual([
      ["Name", "Notes"],
      ["Acme, Inc", 'Said "hi"\nthen left'],
      ["Beta", ""],
    ]);
  });

  it("drops the BOM and blank lines, and reads semicolon files", () => {
    expect(parseCsv("﻿Name;Email\n\nAna;ana@x.co\n")).toEqual([
      ["Name", "Email"],
      ["Ana", "ana@x.co"],
    ]);
  });

  it("reads back what the app's own export writes", () => {
    const csv = toCsv(["Name", "Notes"], [["O'Neil, \"Big\" Co", "line1\nline2"]]);
    expect(parseCsv(csv)[1]).toEqual(["O'Neil, \"Big\" Co", "line1\nline2"]);
  });
});

describe("matchColumns", () => {
  it("recognises headings from other systems and lists the rest", () => {
    const { columns, ignored } = matchColumns(["Full Name", "E-mail", "Lead Source", "Account Owner", "Fax"]);
    expect(columns).toMatchObject({ name: 0, email: 1, source: 2, owner: 3 });
    expect(ignored).toEqual(["Fax"]);
  });
});

describe("planImport", () => {
  it("needs a name column", () => {
    expect(planImport(parseCsv("Email\na@b.co"), none).fatal).toMatch(/No name column/);
  });

  it("joins first and last name columns", () => {
    const plan = planImport(parseCsv("First Name,Last Name\nAna,Silva"), none);
    expect(plan.ready[0].name).toBe("Ana Silva");
  });

  it("skips emails already on file or repeated in the file", () => {
    const plan = planImport(parseCsv("Name,Email\nA,old@x.co\nB,new@x.co\nC,NEW@x.co"), {
      ...none,
      existingEmails: new Set(["old@x.co"]),
    });
    expect(plan.ready.map((r) => r.name)).toEqual(["B"]);
    expect(plan.duplicates.map((d) => d.line)).toEqual([2, 4]);
  });

  it("rejects rows without a name or with a bad email, with spreadsheet line numbers", () => {
    const plan = planImport(parseCsv("Name,Email\n,a@b.co\nBob,not an email\nCal,"), none);
    expect(plan.problems).toEqual([
      { line: 2, message: "No name." },
      { line: 3, message: '"not an email" isn\'t a valid email address.' },
    ]);
    expect(plan.ready).toHaveLength(1);
  });

  it("maps status, source, credit and owner, warning about unknown values", () => {
    const plan = planImport(
      parseCsv("Name,Status,Source,Credit limit,Owner\nA,Customer,LinkedIn,\"$1,500\",sam@team.co\nB,Maybe,Billboard,lots,who@else.co"),
      { ...none, teamByEmail: new Map([["sam@team.co", "user-sam"]]) }
    );
    expect(plan.ready[0]).toMatchObject({ status: "ACTIVE", source: "SOCIAL", creditLimit: 1500, ownerId: "user-sam" });
    expect(plan.ready[1]).toMatchObject({ status: "LEAD", source: null, creditLimit: null, ownerId: null });
    expect(plan.warnings.filter((w) => w.line === 3)).toHaveLength(4);
  });
});
