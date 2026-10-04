import { describe, expect, it } from "vitest";
import { asCustomValues, formatCustomValue, parseOptions, readCustomValues, type CustomFieldDef } from "./custom-fields";
import { leadScore, scoreBand, type LeadFacts } from "./lead-score";
import { findDuplicateGroups, groupKey, mergeCustomerFields, normalizeName, normalizePhone, type MergeFields } from "./crm-duplicates";
import { bodyToHtml, dueAfter, renderTemplate, stepDays } from "./sequences";
import { emailActivityBody, matchEmail, parseAddresses } from "./mail-parse";
import { LeadFormSchema, spamReason } from "./lead-form";

describe("custom fields", () => {
  const fields: CustomFieldDef[] = [
    { id: "a", label: "Industry", type: "SELECT", options: ["Retail", "Mining"] },
    { id: "b", label: "Staff", type: "NUMBER", options: [] },
    { id: "c", label: "Renewal", type: "DATE", options: [] },
    { id: "d", label: "Notes", type: "TEXT", options: [] },
  ];

  it("reads valid values, skips blanks and names the invalid ones", () => {
    const form: Record<string, string> = { cf_a: "Mining", cf_b: "1,200", cf_c: "2026-03-12", cf_d: "  " };
    const { values, invalid } = readCustomValues(fields, (n) => form[n] ?? null);
    expect(values).toEqual({ a: "Mining", c: "2026-03-12" });
    expect(invalid).toEqual(["Staff"]);
  });

  it("refuses a choice that is not on the list and a date that is not a date", () => {
    const form: Record<string, string> = { cf_a: "Farming", cf_c: "12/03/2026", cf_b: "42" };
    const { values, invalid } = readCustomValues(fields, (n) => form[n] ?? null);
    expect(values).toEqual({ b: 42 });
    expect(invalid).toEqual(["Industry", "Renewal"]);
  });

  it("parses dropdown choices without blanks or repeats", () => {
    expect(parseOptions("Retail\n retail ,Mining,,\nFarming")).toEqual(["Retail", "Mining", "Farming"]);
  });

  it("formats values for reading and ignores junk in the stored JSON", () => {
    expect(formatCustomValue(fields[1], 1200)).toBe("1,200");
    expect(formatCustomValue(fields[2], "2026-03-12")).toBe("12 Mar 2026");
    expect(formatCustomValue(fields[3], undefined)).toBeNull();
    expect(asCustomValues({ a: "x", b: 2, c: { nested: true }, d: null })).toEqual({ a: "x", b: 2 });
    expect(asCustomValues([1, 2])).toEqual({});
  });
});

describe("lead score", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const cold: LeadFacts = {
    source: null,
    hasEmail: false,
    hasPhone: false,
    emailOptOut: false,
    recentActivities: 0,
    lastTouchAt: null,
    openDeals: 0,
    bestOpenProbability: 0,
    wonDeals: 0,
    lostDeals: 0,
    openQuotes: 0,
    acceptedQuotes: 0,
    recentOrders: 0,
  };

  it("scores a customer with nothing going on at zero", () => {
    expect(leadScore(cold, now)).toEqual({ score: 0, reasons: [] });
  });

  it("rates an engaged referral with an open deal and a quote out as hot, with reasons", () => {
    const { score, reasons } = leadScore(
      {
        ...cold,
        source: "REFERRAL",
        hasEmail: true,
        recentActivities: 3,
        lastTouchAt: new Date("2026-10-03T12:00:00Z"),
        openDeals: 1,
        bestOpenProbability: 50,
        openQuotes: 1,
      },
      now
    );
    // 20 this week + 15 activities + 10 open deal + 8 (50% x 0.15) + 10 quote + 10 referral + 3 email
    expect(score).toBe(76);
    expect(scoreBand(score)).toBe("hot");
    expect(reasons.map((r) => r.label)).toContain("In touch this week");
  });

  it("cools down with time, never goes below zero or above 100", () => {
    const month = leadScore({ ...cold, lastTouchAt: new Date("2026-09-20T12:00:00Z") }, now).score;
    const quarter = leadScore({ ...cold, lastTouchAt: new Date("2026-07-20T12:00:00Z") }, now).score;
    expect(month).toBeGreaterThan(quarter);
    expect(leadScore({ ...cold, emailOptOut: true, lostDeals: 2 }, now).score).toBe(0);
    const everything = leadScore(
      { ...cold, source: "REFERRAL", hasEmail: true, hasPhone: true, recentActivities: 9, lastTouchAt: now, openDeals: 2, bestOpenProbability: 90, wonDeals: 1, openQuotes: 1, acceptedQuotes: 1, recentOrders: 2 },
      now
    );
    expect(everything.score).toBe(100);
  });
});

describe("duplicate customers", () => {
  it("normalises phones and names so different spellings match", () => {
    expect(normalizePhone("+27 82 123 4567")).toBe(normalizePhone("082-123-4567"));
    expect(normalizePhone("12 34")).toBeNull();
    expect(normalizeName("Acme (Pty) Ltd")).toBe(normalizeName("ACME"));
    expect(normalizeName("Smith, John")).toBe(normalizeName("john smith"));
    expect(normalizeName("Al")).toBeNull();
  });

  it("chains matches into one group and skips dismissed groups", () => {
    const customers = [
      { id: "a", name: "Ann Lee", email: "ann@x.com", phone: null },
      { id: "b", name: "A. Lee", email: "ANN@x.com ", phone: "082 123 4567" },
      { id: "c", name: "Lee Holdings", email: null, phone: "+27821234567" },
      { id: "d", name: "Bob Brown", email: "bob@y.com", phone: null },
    ];
    const groups = findDuplicateGroups(customers);
    expect(groups).toHaveLength(1);
    expect(groups[0].ids.sort()).toEqual(["a", "b", "c"]);
    expect(groups[0].reasons).toEqual(["email", "phone"]);
    expect(findDuplicateGroups(customers, new Set([groupKey(["c", "b", "a"])]))).toHaveLength(0);
  });

  it("keeps the kept customer's details and fills its blanks from the others", () => {
    const base: MergeFields = {
      email: null,
      phone: "011",
      company: null,
      notes: "First",
      status: "LEAD",
      source: null,
      ownerId: "u1",
      campaignId: null,
      creditLimit: null,
      customFields: { a: "x" },
      emailOptOut: false,
    };
    const merged = mergeCustomerFields(base, [
      { ...base, email: "ann@x.com", phone: "022", company: "Acme", notes: "Second", status: "ACTIVE", customFields: { a: "y", b: 2 }, emailOptOut: true },
    ]);
    expect(merged).toMatchObject({ email: "ann@x.com", phone: "011", company: "Acme", status: "ACTIVE", ownerId: "u1", emailOptOut: true });
    expect(merged.notes).toBe("First\n\nSecond");
    expect(merged.customFields).toEqual({ a: "x", b: 2 });
  });
});

describe("email sequences", () => {
  const vars = { name: "Thandi Mokoena", company: null, senderName: "Ana", myCompany: "Acme" };

  it("fills placeholders, with a fallback for a missing company", () => {
    expect(renderTemplate("Hi {{first_name}}, about {{ company }} from {{sender_name}} at {{my_company}}{{nope}}", vars)).toBe(
      "Hi Thandi, about your company from Ana at Acme"
    );
  });

  it("turns plain text into safe paragraphs with an unsubscribe line", () => {
    const html = bodyToHtml("Hello <b>you</b>\nline two\n\nBye", "https://app/u/x");
    expect(html).toContain("<p>Hello &lt;b&gt;you&lt;/b&gt;<br/>line two</p><p>Bye</p>");
    expect(html).toContain('href="https://app/u/x"');
    expect(bodyToHtml("Hi", null)).toBe("<p>Hi</p>");
  });

  it("works out when each step is due", () => {
    expect(stepDays([0, 3, 4])).toEqual([0, 3, 7]);
    expect(dueAfter(new Date("2026-10-01T00:00:00Z"), 2).toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
});

describe("mailbox sync matching", () => {
  const byEmail = new Map([
    ["ann@x.com", "c1"],
    ["bob@y.com", "c2"],
  ]);

  it("parses address headers", () => {
    expect(parseAddresses('"Lee, Ann" <Ann@X.com>, bob@y.com')).toEqual(["ann@x.com", "bob@y.com"]);
    expect(parseAddresses(null)).toEqual([]);
  });

  it("matches incoming mail by sender and outgoing mail by recipients", () => {
    expect(matchEmail({ from: "Ann <ann@x.com>", to: "me@co.com", cc: null, subject: "Hi" }, "me@co.com", byEmail)).toEqual({
      direction: "in",
      customerIds: ["c1"],
    });
    expect(matchEmail({ from: "Me <ME@co.com>", to: "ann@x.com", cc: "bob@y.com, ann@x.com", subject: "Hi" }, "me@co.com", byEmail)).toEqual({
      direction: "out",
      customerIds: ["c1", "c2"],
    });
    expect(matchEmail({ from: "news@shop.com", to: "me@co.com", cc: "ann@x.com", subject: null }, "me@co.com", byEmail).customerIds).toEqual([]);
  });

  it("writes a short activity line", () => {
    expect(emailActivityBody("in", "  ", " Hello\n there ")).toBe("Email received: (no subject)\nHello there");
    expect(emailActivityBody("out", "x".repeat(2000), null)).toHaveLength(1000);
  });
});

describe("web lead form", () => {
  it("needs a name and a real email", () => {
    expect(LeadFormSchema.safeParse({ name: "Ann", email: "ann@x.com" }).success).toBe(true);
    expect(LeadFormSchema.safeParse({ name: "A", email: "ann@x.com" }).success).toBe(false);
    expect(LeadFormSchema.safeParse({ name: "Ann", email: "nope" }).success).toBe(false);
  });

  it("spots the honeypot, instant posts and stale forms", () => {
    const now = 1_000_000_000;
    expect(spamReason({ honeypot: "http://spam", startedAt: now - 10_000, now })).toBe("honeypot");
    expect(spamReason({ honeypot: "", startedAt: now - 500, now })).toBe("too-fast");
    expect(spamReason({ honeypot: null, startedAt: Number.NaN, now })).toBe("too-fast");
    expect(spamReason({ honeypot: null, startedAt: now - 2 * 24 * 60 * 60 * 1000, now })).toBe("stale");
    expect(spamReason({ honeypot: null, startedAt: now - 10_000, now })).toBeNull();
  });
});
