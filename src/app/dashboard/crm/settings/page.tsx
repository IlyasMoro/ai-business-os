import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, Mail } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { hasFeature } from "@/lib/plan-limits";
import { canReadMail } from "@/lib/google-token";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-dark/card";
import { Input, Label, Select, Textarea } from "@/components/ui-dark/input";
import { SubmitButton } from "@/components/ui-dark/submit-button";
import { SettingToggle } from "@/components/ui-dark/setting-toggle";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { buttonStyles } from "@/components/ui-dark/button";
import { CopyField } from "@/components/ui-dark/copy-field";
import { NewFieldForm } from "@/components/crm/new-field-form";
import { TAG_COLORS, tagColor } from "@/lib/crm-tags";
import { CUSTOM_FIELD_TYPES } from "@/lib/custom-fields";
import { FORM_DEFAULTS } from "@/lib/lead-form";
import { cn } from "@/lib/utils";
import {
  createCustomField,
  createTag,
  deleteCustomField,
  deleteTag,
  moveCustomField,
  resetLeadFormLink,
  saveEmailLogging,
  saveLeadForm,
  saveVisibility,
  saveAutoSteps,
  saveWhatsApp,
  syncMailNow,
  updateCustomField,
  updateTag,
} from "@/lib/actions/crm-settings";

export const metadata = { title: "CRM settings" };

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-500">{description}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ColorSelect({ id, value }: { id: string; value: string }) {
  return (
    <Select id={id} name="color" defaultValue={value} aria-label="Colour" className="w-32">
      {TAG_COLORS.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </Select>
  );
}

const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Tags, custom fields, who sees which customers, the web lead form and
 * email logging. Owners and admins only. */
export default async function CrmSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; reset?: string; synced?: string; connected?: string }>;
}) {
  const session = await requireRole(["OWNER", "ADMIN"]);
  const { error, saved, reset, synced, connected } = await searchParams;

  const [tags, fields, settings, users, integration, integrationsAllowed] = await Promise.all([
    db.customerTag.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, _count: { select: { customers: true } } },
    }),
    db.customField.findMany({ where: { companyId: session.companyId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    db.crmSettings.findUnique({ where: { companyId: session.companyId } }),
    db.user.findMany({ where: { companyId: session.companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.googleIntegration.findUnique({ where: { companyId: session.companyId }, select: { email: true, scopes: true, mailSyncedAt: true } }),
    hasFeature(session.companyId, "integrations"),
  ]);

  const base = process.env.APP_BASE_URL ?? "";
  const formUrl = settings?.formToken ? `${base}/f/${settings.formToken}` : null;
  const embedCode = formUrl
    ? `<iframe src="${formUrl}?embed=1" title="Contact form" style="width:100%;max-width:560px;height:640px;border:0" loading="lazy"></iframe>`
    : null;
  const mailReady = canReadMail(integration);

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-50 light:text-slate-900">CRM settings</h2>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-500">How your team labels, sees and gathers customers.</p>

      <div className="mt-4 space-y-3">
        <ErrorBanner code={error} />
        {(saved || reset || connected || synced !== undefined) && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 light:text-emerald-700">
            {reset
              ? "The form has a new link. Update it anywhere you shared or embedded the old one."
              : connected
                ? "Google is connected. Turn on email logging below if it isn't on yet."
                : synced !== undefined
                  ? `Mailbox checked. ${Number(synced) || 0} new ${Number(synced) === 1 ? "email" : "emails"} logged.`
                  : "Saved."}
          </div>
        )}
      </div>

      <div className="mt-4 grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Section id="tags" title="Tags" description="Labels like VIP or Wholesale. Add them on the customer form, then filter the customer list by them.">
            {tags.length > 0 && (
              <ul className="mb-5 divide-y divide-white/[0.06] light:divide-slate-200">
                {tags.map((tag) => (
                  <li key={tag.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <form action={updateTag.bind(null, tag.id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", tagColor(tag.color).dot)} aria-hidden />
                      <Input name="name" defaultValue={tag.name} required maxLength={40} aria-label="Tag name" className="w-auto min-w-0 flex-1" />
                      <ColorSelect id={`color-${tag.id}`} value={tag.color} />
                      <SubmitButton variant="ghost" pendingText="Saving..." className="px-2.5">
                        Save
                      </SubmitButton>
                    </form>
                    <span className="w-24 text-right text-xs tabular-nums text-slate-500">
                      {tag._count.customers} {tag._count.customers === 1 ? "customer" : "customers"}
                    </span>
                    <DeleteButton action={deleteTag.bind(null, tag.id)} confirmMessage={`Remove the tag "${tag.name}" from every customer?`} label="" />
                  </li>
                ))}
              </ul>
            )}
            <form action={createTag} className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <Label htmlFor="new-tag">New tag</Label>
                <Input id="new-tag" name="name" required maxLength={40} placeholder="For example, VIP" />
              </div>
              <ColorSelect id="new-tag-color" value="blue" />
              <SubmitButton variant="secondary" pendingText="Adding...">
                Add tag
              </SubmitButton>
            </form>
          </Section>

          <Section id="fields" title="Custom fields" description="Your own details on every customer, such as Industry or Contract end date. They show on the customer form and page.">
            {fields.length > 0 && (
              <ul className="mb-5 space-y-3">
                {fields.map((field, i) => (
                  <li key={field.id} className="rounded-xl border border-white/[0.08] p-3 light:border-slate-200">
                    <div className="flex items-start gap-2">
                      <form action={updateCustomField.bind(null, field.id)} className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input name="label" defaultValue={field.label} required maxLength={60} aria-label="Field name" className="w-auto min-w-0 flex-1" />
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-400 light:border-slate-200 light:text-slate-500">
                            {CUSTOM_FIELD_TYPES.find((t) => t.id === field.type)?.label}
                          </span>
                          <SubmitButton variant="ghost" pendingText="Saving..." className="px-2.5">
                            Save
                          </SubmitButton>
                        </div>
                        {field.type === "SELECT" && (
                          <Textarea name="options" rows={3} defaultValue={field.options.join("\n")} aria-label="Choices, one per line" className="text-xs" />
                        )}
                      </form>
                      <div className="flex shrink-0 items-center">
                        <form action={moveCustomField.bind(null, field.id, "up")}>
                          <button type="submit" disabled={i === 0} aria-label="Move up" className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-30 light:hover:bg-slate-100">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                        </form>
                        <form action={moveCustomField.bind(null, field.id, "down")}>
                          <button type="submit" disabled={i === fields.length - 1} aria-label="Move down" className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-30 light:hover:bg-slate-100">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </form>
                        <DeleteButton
                          action={deleteCustomField.bind(null, field.id)}
                          confirmMessage={`Delete "${field.label}" and the values saved in it for every customer?`}
                          label=""
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <NewFieldForm action={createCustomField} />
          </Section>

          <Section
            id="auto-steps"
            title="Automatic steps"
            description="Things AIBOS does for you, with nothing to set up. Each adds a reminder for the person who owns the quote, deal or customer."
          >
            <form action={saveAutoSteps} className="space-y-4">
              <SettingToggle
                name="autoQuoteOpened"
                label="Call when a quote is opened"
                description="When a customer opens their quote online, a reminder to call them now, while it's on their mind."
                defaultChecked={settings?.autoQuoteOpened ?? true}
              />
              <SettingToggle
                name="autoQuoteExpiry"
                label="Quote about to expire"
                description="Two days before a sent quote runs out without an answer, a reminder to follow up."
                defaultChecked={settings?.autoQuoteExpiry ?? true}
              />
              <SettingToggle
                name="autoDealOverdue"
                label="Deal past its close date"
                description="When an open deal passes its expected close date, a reminder to win it, lose it or move the date."
                defaultChecked={settings?.autoDealOverdue ?? true}
              />
              <SettingToggle
                name="dailyDigest"
                label="Morning summary email"
                description="Each morning at about 07:00 South African time, everyone gets an email of their reminders due today and any overdue. Nothing is sent on a day with none."
                defaultChecked={settings?.dailyDigest ?? true}
              />
              <SubmitButton pendingText="Saving...">Save</SubmitButton>
            </form>
            <p className="mt-3 text-xs text-slate-500">Also automatic: a lead becomes an active customer when they accept a quote or place an order.</p>
          </Section>

          <Section id="visibility" title="Who sees which customers" description="Owners and admins always see every customer.">
            <form action={saveVisibility} className="space-y-4">
              <SettingToggle
                name="ownCustomersOnly"
                label="Employees see only their own customers"
                description="Each employee sees the customers they own, with those customers' deals, quotes and reminders, plus anything assigned to them."
                defaultChecked={settings?.ownCustomersOnly ?? false}
              />
              <SubmitButton pendingText="Saving...">Save</SubmitButton>
            </form>
          </Section>

          <Section id="whatsapp" title="WhatsApp" description="The WhatsApp button on customers, deals and quotes opens a chat with a ready written message. Numbers saved without a country code get this one.">
            <form action={saveWhatsApp} className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="whatsappCountryCode">Country code</Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">+</span>
                  <Input
                    id="whatsappCountryCode"
                    name="whatsappCountryCode"
                    inputMode="numeric"
                    maxLength={4}
                    defaultValue={settings?.whatsappCountryCode ?? "27"}
                    className="w-20"
                  />
                </div>
              </div>
              <SubmitButton variant="secondary" pendingText="Saving...">
                Save
              </SubmitButton>
            </form>
            <p className="mt-2 text-xs text-slate-500">27 for South Africa: 082 123 4567 becomes +27 82 123 4567.</p>
          </Section>
        </div>

        <div className="space-y-6">
          <Section id="lead-form" title="Web lead form" description="A contact form for your website. Each message becomes a lead with the source Website, and the owner gets a reminder and an email.">
            <form action={saveLeadForm} className="space-y-4">
              <SettingToggle
                name="formEnabled"
                label="Take messages"
                description="When off, the form says it isn't taking messages."
                defaultChecked={settings?.formEnabled ?? false}
              />
              <div>
                <Label htmlFor="formTitle">Heading</Label>
                <Input id="formTitle" name="formTitle" maxLength={80} defaultValue={settings?.formTitle ?? ""} placeholder={FORM_DEFAULTS.title} />
              </div>
              <div>
                <Label htmlFor="formIntro">Intro</Label>
                <Textarea id="formIntro" name="formIntro" rows={2} maxLength={400} defaultValue={settings?.formIntro ?? ""} placeholder={FORM_DEFAULTS.intro} />
              </div>
              <div>
                <Label htmlFor="formThanks">Thank you message</Label>
                <Textarea id="formThanks" name="formThanks" rows={2} maxLength={400} defaultValue={settings?.formThanks ?? ""} placeholder={FORM_DEFAULTS.thanks} />
              </div>
              <div>
                <Label htmlFor="formOwnerId">New leads go to</Label>
                <Select id="formOwnerId" name="formOwnerId" defaultValue={settings?.formOwnerId ?? ""}>
                  <option value="">The company owner</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
              <SubmitButton pendingText="Saving...">{formUrl ? "Save form" : "Create the form"}</SubmitButton>
            </form>

            {formUrl && embedCode && (
              <div className="mt-6 space-y-4 border-t border-white/[0.06] pt-5 light:border-slate-200">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-300 light:text-slate-600">Link to share</p>
                  <CopyField value={formUrl} label="Form link" />
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-300 light:text-slate-600">Code to put the form on your website</p>
                  <CopyField value={embedCode} label="Embed code" multiline />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a href={formUrl} target="_blank" rel="noreferrer" className={buttonStyles("secondary", "sm")}>
                    <ExternalLink className="h-4 w-4" />
                    Open the form
                  </a>
                  <form action={resetLeadFormLink}>
                    <SubmitButton variant="ghost" pendingText="Resetting...">
                      Get a new link
                    </SubmitButton>
                  </form>
                </div>
                <p className="text-xs text-slate-500">Getting a new link stops the old one working, for example if the form starts getting spam.</p>
              </div>
            )}
          </Section>

          <Section
            id="email-logging"
            title="Email logging"
            description="Logs emails to and from your customers, found in your connected Gmail, on each customer's history. Only the subject, who it was from and to, and a short preview are saved."
          >
            {!integrationsAllowed ? (
              <p className="text-sm text-slate-400 light:text-slate-500">Email logging uses the Google integration, which comes with the Starter plan and up.</p>
            ) : !integration ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-400 light:text-slate-500">Connect the Gmail account your team uses with customers.</p>
                <a href="/api/integrations/google/connect?mail=1" className={buttonStyles("primary")}>
                  <Mail className="h-4 w-4" />
                  Connect Gmail
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-300 light:text-slate-600">
                  Connected to <span className="font-semibold">{integration.email}</span>
                  {integration.mailSyncedAt && <span className="text-slate-500"> · last checked {when(integration.mailSyncedAt)}</span>}
                </p>
                {!mailReady && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 light:text-amber-800">
                    This account was connected for sending only. Reconnect it and allow reading mail to log customer emails.
                    <div className="mt-3">
                      <a href="/api/integrations/google/connect?mail=1" className={buttonStyles("secondary", "sm")}>
                        <Mail className="h-4 w-4" />
                        Reconnect Gmail
                      </a>
                    </div>
                  </div>
                )}
                <form action={saveEmailLogging} className="space-y-4">
                  <SettingToggle
                    name="emailLogging"
                    label="Log customer emails"
                    description="Checked every 15 minutes. A customer who replies is also taken out of any email sequence they are in."
                    defaultChecked={settings?.emailLogging ?? false}
                  />
                  <SubmitButton pendingText="Saving...">Save</SubmitButton>
                </form>
                {mailReady && settings?.emailLogging && (
                  <form action={syncMailNow}>
                    <SubmitButton variant="secondary" pendingText="Checking the mailbox...">
                      Check now
                    </SubmitButton>
                  </form>
                )}
                <p className="text-xs text-slate-500">
                  Manage the connection on the{" "}
                  <Link href="/dashboard/integrations" className="text-blue-400 hover:text-blue-300 light:text-blue-700">
                    Integrations page
                  </Link>
                  .
                </p>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
