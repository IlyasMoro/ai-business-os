import { describe, expect, it } from "vitest";
import { cleanRule, describeRule, reminderDue, ruleProblem, RuleInputSchema, stageTriggers } from "./crm-rules";
import { fillWhatsApp, whatsappLink, whatsappNumber } from "./whatsapp";

describe("whatsapp numbers", () => {
  it("adds the country code to local numbers and keeps international ones", () => {
    expect(whatsappNumber("082 123 4567", "27")).toBe("27821234567");
    expect(whatsappNumber("+27 82 123 4567", "27")).toBe("27821234567");
    expect(whatsappNumber("0044 7700 900123", "27")).toBe("447700900123");
    expect(whatsappNumber("+44 7700 900123", "27")).toBe("447700900123");
    expect(whatsappNumber("82 123 4567", "27")).toBe("27821234567");
    expect(whatsappNumber("27821234567", "27")).toBe("27821234567");
  });

  it("refuses numbers that are too short or missing", () => {
    expect(whatsappNumber("12345", "27")).toBeNull();
    expect(whatsappNumber("", "27")).toBeNull();
    expect(whatsappNumber(null, "27")).toBeNull();
  });

  it("builds the link and fills the message", () => {
    expect(whatsappLink("27821234567", " Hi there ")).toBe("https://wa.me/27821234567?text=Hi%20there");
    expect(whatsappLink("27821234567", "  ")).toBe("https://wa.me/27821234567");
    expect(
      fillWhatsApp("Hi {{first_name}}, quote {{quote_number}} from {{my_company}}: {{quote_link}}{{unknown}}", {
        name: "Thandi Mokoena",
        senderName: "Ana",
        myCompany: "Acme",
        quoteLink: "https://x/q/abc",
        quoteNumber: "Q0003",
      })
    ).toBe("Hi Thandi, quote Q0003 from Acme: https://x/q/abc");
  });
});

describe("crm rules", () => {
  const base = { name: "Won", trigger: "DEAL_WON", action: "CREATE_REMINDER" };

  it("says what a rule is missing", () => {
    expect(ruleProblem(RuleInputSchema.parse(base))).toBe("Give the reminder a title.");
    expect(ruleProblem(RuleInputSchema.parse({ ...base, title: "Book delivery" }))).toBeNull();
    expect(ruleProblem(RuleInputSchema.parse({ ...base, trigger: "DEAL_STAGE", title: "x" }))).toBe("Choose the stage.");
    expect(ruleProblem(RuleInputSchema.parse({ ...base, trigger: "CUSTOMER_QUIET", title: "x" }))).toBe("Say after how many days without contact.");
    expect(ruleProblem(RuleInputSchema.parse({ ...base, action: "EMAIL_PERSON" }))).toBe("Write the message to send.");
  });

  it("treats blank form fields as not set and keeps only what the rule uses", () => {
    const parsed = RuleInputSchema.parse({ ...base, title: "Book delivery", stage: "", quietDays: "", tagId: "tag1", dueInDays: "2" });
    expect(cleanRule(parsed)).toMatchObject({ stage: null, quietDays: null, tagId: null, title: "Book delivery", dueInDays: 2, assigneeId: null });
  });

  it("describes a rule in one sentence", () => {
    const names = { users: new Map([["u1", "Sipho"]]), tags: new Map([["t1", "VIP"]]), sequences: new Map() };
    const rule = {
      trigger: "DEAL_WON" as const,
      stage: null,
      quietDays: null,
      action: "CREATE_REMINDER" as const,
      title: "Book delivery",
      dueInDays: 1,
      assigneeId: "u1",
      tagId: null,
      sequenceId: null,
      status: null,
    };
    expect(describeRule(rule, names)).toBe('When a deal is won, add the reminder "Book delivery" for Sipho, due the next day.');
    expect(describeRule({ ...rule, trigger: "CUSTOMER_QUIET", quietDays: 30, action: "ADD_TAG", tagId: "t1" }, names)).toBe(
      "When a customer has had no contact for 30 days, tag the customer VIP."
    );
    expect(describeRule({ ...rule, trigger: "DEAL_STAGE", stage: "PROPOSAL", assigneeId: null, dueInDays: 0 }, names)).toBe(
      'When a deal moves to Proposal, add the reminder "Book delivery" for the customer\'s owner, due today.'
    );
  });

  it("raises won and lost along with the stage", () => {
    expect(stageTriggers("WON")).toEqual(["DEAL_STAGE", "DEAL_WON"]);
    expect(stageTriggers("LOST")).toEqual(["DEAL_STAGE", "DEAL_LOST"]);
    expect(stageTriggers("PROPOSAL")).toEqual(["DEAL_STAGE"]);
  });

  it("sets reminders for 9:00, never in the past", () => {
    const morning = new Date(2026, 9, 5, 7, 0);
    expect(reminderDue(morning, 0)).toEqual(new Date(2026, 9, 5, 9, 0));
    expect(reminderDue(morning, 2)).toEqual(new Date(2026, 9, 7, 9, 0));
    const afternoon = new Date(2026, 9, 5, 15, 0);
    expect(reminderDue(afternoon, 0)).toEqual(afternoon);
  });
});
