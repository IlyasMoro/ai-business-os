import { Building2, Clock, MessageSquare } from "lucide-react";
import { ContactForm } from "@/components/landing/contact-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { topicFromQuery } from "@/lib/contact";

export const metadata = {
  title: "Contact us",
  description: "Questions about AIBOS, plans or the Enterprise plan? Send us a message.",
};

/* The public contact page, on the same dark glass screen as sign in.
   Messages go to the platform admin inbox (/dashboard/admin/messages) and to
   the operator by email when email is set up. ?topic=enterprise comes from
   "Talk to us". */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  return (
    <AuthShell
      wide
      title="Talk to us"
      sub="Questions about AIBOS, your plan or your data? Send a message and a person will reply."
      topLink={{ lead: "Already using AIBOS?", label: "Sign in", href: "/login" }}
      panelEyebrow="How we can help"
      panelTitle="Real people, quick answers."
      points={[
        { icon: MessageSquare, text: "Not sure which plan fits? Tell us your team size and branches" },
        { icon: Building2, text: "Enterprise: contracts, invoicing instead of a card, big teams" },
        { icon: Clock, text: "We reply by email, usually within one working day" },
      ]}
    >
      <ContactForm topic={topicFromQuery(topic)} />
    </AuthShell>
  );
}
