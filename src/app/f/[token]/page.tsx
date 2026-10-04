import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CustomerShell } from "@/components/public/customer-shell";
import { FORM_DEFAULTS } from "@/lib/lead-form";
import { submitLeadForm } from "./actions";
import { LeadForm } from "./lead-form";

export const metadata: Metadata = { title: "Contact us", robots: { index: false, follow: false } };

/** The company's web lead form, as its own page or (with ?embed=1) inside
 * an iframe on the company's website. */
export default async function LeadFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { token } = await params;
  const { embed } = await searchParams;
  const settings = await db.crmSettings.findUnique({
    where: { formToken: token },
    include: { companyRef: { select: { id: true, name: true, logoMimeType: true } } },
  });
  if (!settings) notFound();

  const company = { id: settings.companyRef.id, name: settings.companyRef.name, hasLogo: Boolean(settings.companyRef.logoMimeType) };
  const bare = embed === "1";

  return (
    <CustomerShell company={company} width="max-w-xl" bare={bare}>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{settings.formTitle || FORM_DEFAULTS.title}</h1>
      <p className="mb-6 mt-1.5 text-sm leading-relaxed text-slate-500">{settings.formIntro || FORM_DEFAULTS.intro}</p>
      {settings.formEnabled ? (
        <LeadForm action={submitLeadForm.bind(null, token)} thanks={settings.formThanks || FORM_DEFAULTS.thanks} />
      ) : (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">This form isn&apos;t taking messages right now. Please contact {company.name} directly.</p>
      )}
    </CustomerShell>
  );
}
