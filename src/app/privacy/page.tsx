import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black px-4 py-12 text-slate-300">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
          Back to home
        </Link>

        <h1 className="mt-6 text-2xl font-semibold text-slate-50">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: July 9, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed">
          <section>
            <p>
              This Privacy Policy explains how [Company Legal Name] (&ldquo;we,&rdquo;
              &ldquo;us,&rdquo; or &ldquo;the Company&rdquo;) collects, uses, and protects
              information in connection with AIBOS (the &ldquo;Service&rdquo;). It applies
              to account holders, the users they invite into their company workspace, and, where
              relevant, individuals whose information is entered into the Service by a customer,
              such as employees or contacts of that customer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">1. Information We Collect</h2>
            <p className="mt-2">We collect the following categories of information:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>
                Account information you provide when you register, such as your name, email
                address, and password. Passwords are stored using a one way hash and are never
                stored or viewable in plain text.
              </li>
              <li>
                Business data you or your team enter into the Service, which may include customer
                records, sales and financial transactions, inventory and supplier information,
                invoices, employee records, payroll figures, project and support tickets,
                marketing campaigns, calendar entries, and files you upload.
              </li>
              <li>
                Communications you send us, such as support requests.
              </li>
              <li>
                Usage information such as login timestamps and general activity within the
                Service, used to operate, secure, and improve the Service.
              </li>
              <li>
                If you choose to connect a Gmail account through the Integrations page, an
                authorization token that allows the Service to send email on your behalf. We do
                not read the general content of your Gmail inbox.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">2. How We Use Information</h2>
            <p className="mt-2">We use the information described above to:</p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Provide, maintain, and secure the Service, including authenticating logins.</li>
              <li>Send transactional email, such as password resets and notifications you request.</li>
              <li>
                Provide AI assistant responses, which may involve sending relevant portions of
                your business data to our AI model provider solely to generate a response to your
                request.
              </li>
              <li>Respond to support requests and communicate with you about your account.</li>
              <li>Detect, investigate, and prevent fraud, abuse, and security incidents.</li>
              <li>Comply with legal obligations.</li>
            </ul>
            <p className="mt-2">
              We do not sell personal information, and we do not use your business data to train
              AI models on behalf of any other customer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">3. Who We Share Information With</h2>
            <p className="mt-2">
              We share information with a limited set of service providers who process it on our
              behalf, under contractual confidentiality obligations, including:
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-5">
              <li>Our infrastructure and hosting provider, which runs the application.</li>
              <li>Our managed database provider, which stores your data.</li>
              <li>Our transactional email provider, which delivers emails sent from the Service.</li>
              <li>Our AI model provider, which processes requests sent to the AI assistant.</li>
              <li>
                Google, if you choose to connect your Gmail account through the Integrations
                page.
              </li>
            </ul>
            <p className="mt-2">
              We may also disclose information if required by law, or to protect the rights,
              property, or safety of the Company, our customers, or others. If the Company is
              involved in a merger, acquisition, or sale of assets, information may be transferred
              as part of that transaction, subject to this Privacy Policy or a policy at least as
              protective.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">4. Data Retention</h2>
            <p className="mt-2">
              We retain your business data for as long as your account remains active. If you
              request deletion of your workspace, we will delete or anonymize your business data
              within a reasonable period, except where retention is required to comply with a
              legal obligation, resolve disputes, or enforce our agreements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">5. Security</h2>
            <p className="mt-2">
              We use industry standard safeguards to protect information, including password
              hashing, encrypted connections in transit, and access controls that keep each
              company&apos;s data separated from every other company&apos;s data. No method of
              transmission
              or storage is completely secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">6. Your Rights</h2>
            <p className="mt-2">
              Depending on where you are located, you may have rights to access, correct, export,
              or delete personal information we hold about you, or to object to or restrict
              certain processing. To exercise these rights, contact us at [Contact Email]. If your
              information was entered into the Service by your employer or another company using
              the Service, please contact that company directly, as they control that data and we
              act on their instructions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">7. Children</h2>
            <p className="mt-2">
              The Service is intended for business use by adults and is not directed to children.
              We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">
              8. International Data Transfers
            </h2>
            <p className="mt-2">
              Your information may be processed in a country other than the one in which you are
              located. Where required, we rely on appropriate safeguards to protect information
              transferred across borders.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">9. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. If we make material changes, we
              will provide notice, such as by posting an update within the Service or contacting
              the account owner directly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-50">10. Contact</h2>
            <p className="mt-2">
              Questions about this Privacy Policy can be sent to [Contact Email].
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
