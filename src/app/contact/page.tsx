import Link from "next/link";
import { Building2, Clock, MessageSquare } from "lucide-react";
import { ContactForm } from "@/components/landing/contact-form";
import { SplitCardPage } from "@/components/landing/split-card-page";
import { topicFromQuery } from "@/lib/contact";

export const metadata = {
  title: "Contact us",
  description: "Questions about AIBOS, plans or the Enterprise plan? Send us a message.",
};

/* The public contact page, in the landing page's look. Messages go to the
   platform admin inbox (/dashboard/admin/messages) and to the operator by
   email when email is set up. ?topic=enterprise comes from "Talk to us". */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  return (
    <SplitCardPage
      eyebrow="Contact"
      title="Talk to us"
      sub="Questions about AIBOS, your plan or your data? Send a message and a person will reply."
      panelEyebrow="How we can help"
      points={[
        { icon: MessageSquare, title: "Plans and pricing", text: "Not sure which plan fits? Tell us your team size and branches." },
        { icon: Building2, title: "Enterprise", text: "Contracts, invoicing instead of a card, or a very large team." },
        { icon: Clock, title: "Quick replies", text: "We reply by email, usually within one working day." },
      ]}
      panelFoot={
        <>
          Already using AIBOS?{" "}
          <Link href="/login" className="font-semibold text-cyan-300 hover:text-white">
            Sign in
          </Link>{" "}
          and open Help and FAQ from your account menu.
        </>
      }
    >
      <ContactForm topic={topicFromQuery(topic)} />
    </SplitCardPage>
  );
}
