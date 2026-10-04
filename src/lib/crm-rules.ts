/* CRM rules, "when this happens, do that": what can start a rule, what it
   can do, checking a rule before it's saved, and the sentence that
   describes it. No database access here; lib/crm-rules-runner.ts runs them. */

import * as z from "zod";
import { DEAL_STAGE_IDS, stageInfo, type DealStage } from "@/lib/crm-pipeline";

export type RuleTrigger = "DEAL_WON" | "DEAL_LOST" | "DEAL_STAGE" | "QUOTE_ACCEPTED" | "QUOTE_DECLINED" | "NEW_LEAD" | "CUSTOMER_QUIET";
export type RuleAction = "CREATE_REMINDER" | "ADD_TAG" | "ADD_TO_SEQUENCE" | "SET_STATUS" | "EMAIL_PERSON";
export type CustomerStatus = "LEAD" | "ACTIVE" | "INACTIVE";

export const RULE_TRIGGERS: { id: RuleTrigger; label: string }[] = [
  { id: "DEAL_WON", label: "A deal is won" },
  { id: "DEAL_LOST", label: "A deal is lost" },
  { id: "DEAL_STAGE", label: "A deal moves to a stage" },
  { id: "QUOTE_ACCEPTED", label: "A quote is accepted" },
  { id: "QUOTE_DECLINED", label: "A quote is declined" },
  { id: "NEW_LEAD", label: "A new lead comes in" },
  { id: "CUSTOMER_QUIET", label: "A customer goes quiet" },
];

export const RULE_ACTIONS: { id: RuleAction; label: string }[] = [
  { id: "CREATE_REMINDER", label: "Add a reminder" },
  { id: "EMAIL_PERSON", label: "Email someone on the team" },
  { id: "ADD_TAG", label: "Add a tag" },
  { id: "SET_STATUS", label: "Change the customer's status" },
  { id: "ADD_TO_SEQUENCE", label: "Put them in an email sequence" },
];

export const RULE_TRIGGER_IDS = RULE_TRIGGERS.map((t) => t.id) as [RuleTrigger, ...RuleTrigger[]];
export const RULE_ACTION_IDS = RULE_ACTIONS.map((a) => a.id) as [RuleAction, ...RuleAction[]];
export const MAX_RULES = 30;

const STATUS_LABELS: Record<CustomerStatus, string> = { LEAD: "Lead", ACTIVE: "Active", INACTIVE: "Inactive" };

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());
const optionalId = optionalText(40);

/** The fields a rule form sends. Each trigger and action then checks it
 * has what it needs (see ruleProblem). */
export const RuleInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  trigger: z.enum(RULE_TRIGGER_IDS),
  stage: z.preprocess((v) => (v === "" ? undefined : v), z.enum(DEAL_STAGE_IDS as [DealStage, ...DealStage[]]).optional()),
  quietDays: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(1).max(365).optional()),
  action: z.enum(RULE_ACTION_IDS),
  title: optionalText(200),
  dueInDays: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(0).max(365).optional()),
  assigneeId: optionalId,
  tagId: optionalId,
  sequenceId: optionalId,
  status: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["LEAD", "ACTIVE", "INACTIVE"]).optional()),
  message: optionalText(2000),
});

export type RuleInput = z.infer<typeof RuleInputSchema>;

/** What's missing for this trigger and action, in plain words, or null. */
export function ruleProblem(rule: RuleInput): string | null {
  if (rule.trigger === "DEAL_STAGE" && !rule.stage) return "Choose the stage.";
  if (rule.trigger === "CUSTOMER_QUIET" && !rule.quietDays) return "Say after how many days without contact.";
  switch (rule.action) {
    case "CREATE_REMINDER":
      return rule.title ? null : "Give the reminder a title.";
    case "ADD_TAG":
      return rule.tagId ? null : "Choose the tag.";
    case "ADD_TO_SEQUENCE":
      return rule.sequenceId ? null : "Choose the sequence.";
    case "SET_STATUS":
      return rule.status ? null : "Choose the status.";
    case "EMAIL_PERSON":
      return rule.message ? null : "Write the message to send.";
  }
}

/** Only the fields the chosen trigger and action use, so nothing stale is saved. */
export function cleanRule(rule: RuleInput) {
  return {
    name: rule.name,
    trigger: rule.trigger,
    stage: rule.trigger === "DEAL_STAGE" ? (rule.stage ?? null) : null,
    quietDays: rule.trigger === "CUSTOMER_QUIET" ? (rule.quietDays ?? null) : null,
    action: rule.action,
    title: rule.action === "CREATE_REMINDER" ? (rule.title ?? null) : null,
    dueInDays: rule.action === "CREATE_REMINDER" ? (rule.dueInDays ?? 0) : null,
    assigneeId: rule.action === "CREATE_REMINDER" || rule.action === "EMAIL_PERSON" ? (rule.assigneeId ?? null) : null,
    tagId: rule.action === "ADD_TAG" ? (rule.tagId ?? null) : null,
    sequenceId: rule.action === "ADD_TO_SEQUENCE" ? (rule.sequenceId ?? null) : null,
    status: rule.action === "SET_STATUS" ? (rule.status ?? null) : null,
    message: rule.action === "EMAIL_PERSON" ? (rule.message ?? null) : null,
  };
}

type Describable = {
  trigger: RuleTrigger;
  stage: DealStage | null;
  quietDays: number | null;
  action: RuleAction;
  title: string | null;
  dueInDays: number | null;
  assigneeId: string | null;
  tagId: string | null;
  sequenceId: string | null;
  status: CustomerStatus | null;
};

/** Names for ids, from the page: users, tags and sequences. */
export type RuleNames = { users: Map<string, string>; tags: Map<string, string>; sequences: Map<string, string> };

const inDays = (d: number | null) => (!d ? "today" : d === 1 ? "the next day" : `${d} days later`);

/** "When a deal is won, add the reminder "Book delivery" for the owner, the next day." */
export function describeRule(rule: Describable, names: RuleNames): string {
  const when =
    rule.trigger === "DEAL_STAGE"
      ? `When a deal moves to ${rule.stage ? stageInfo(rule.stage).label : "a stage"}`
      : rule.trigger === "CUSTOMER_QUIET"
        ? `When a customer has had no contact for ${rule.quietDays ?? "some"} days`
        : `When ${RULE_TRIGGERS.find((t) => t.id === rule.trigger)!.label.charAt(0).toLowerCase()}${RULE_TRIGGERS.find((t) => t.id === rule.trigger)!.label.slice(1)}`;
  const who = rule.assigneeId ? (names.users.get(rule.assigneeId) ?? "a removed team member") : "the customer's owner";
  let then: string;
  switch (rule.action) {
    case "CREATE_REMINDER":
      then = `add the reminder "${(rule.title ?? "").replace(/\{\{\s*customer\s*\}\}/gi, "the customer")}" for ${who}, due ${inDays(rule.dueInDays)}`;
      break;
    case "EMAIL_PERSON":
      then = `email ${who}`;
      break;
    case "ADD_TAG":
      then = `tag the customer ${rule.tagId ? (names.tags.get(rule.tagId) ?? "with a removed tag") : ""}`.trim();
      break;
    case "SET_STATUS":
      then = `set the customer to ${rule.status ? STATUS_LABELS[rule.status] : "a status"}`;
      break;
    case "ADD_TO_SEQUENCE":
      then = `put them in the sequence "${rule.sequenceId ? (names.sequences.get(rule.sequenceId) ?? "removed") : ""}"`;
      break;
  }
  return `${when}, ${then}.`;
}

/** Which deal stage events a stage change raises: the stage itself, plus won or lost. */
export function stageTriggers(stage: DealStage): RuleTrigger[] {
  if (stage === "WON") return ["DEAL_STAGE", "DEAL_WON"];
  if (stage === "LOST") return ["DEAL_STAGE", "DEAL_LOST"];
  return ["DEAL_STAGE"];
}

/** When a reminder from a rule falls due: that many days on, at 9:00. */
export function reminderDue(now: Date, days: number): Date {
  const due = new Date(now);
  due.setDate(due.getDate() + Math.max(0, days));
  due.setHours(9, 0, 0, 0);
  // Due today but 9:00 has passed: make it now rather than in the past.
  return due < now ? now : due;
}

/** Ready made rules the rules page offers with one click. `needs` says
 * what the company must have first (an email sequence to put leads in). */
export const STARTER_RULES: { id: string; needs?: "sequence"; rule: RuleInput }[] = [
  {
    id: "won-delivery",
    rule: { name: "Arrange delivery when a deal is won", trigger: "DEAL_WON", action: "CREATE_REMINDER", title: "Arrange delivery for {{customer}}", dueInDays: 1 },
  },
  {
    id: "declined-retry",
    rule: { name: "Try again after a declined quote", trigger: "QUOTE_DECLINED", action: "CREATE_REMINDER", title: "Try {{customer}} again with a new offer", dueInDays: 90 },
  },
  {
    id: "quiet-30",
    rule: { name: "Check in after 30 quiet days", trigger: "CUSTOMER_QUIET", quietDays: 30, action: "CREATE_REMINDER", title: "Check in with {{customer}}", dueInDays: 0 },
  },
  {
    id: "lost-learn",
    rule: { name: "Learn why a deal was lost", trigger: "DEAL_LOST", action: "CREATE_REMINDER", title: "Ask {{customer}} what would win them back", dueInDays: 7 },
  },
  {
    id: "lead-sequence",
    needs: "sequence",
    rule: { name: "Welcome new leads by email", trigger: "NEW_LEAD", action: "ADD_TO_SEQUENCE" },
  },
];
