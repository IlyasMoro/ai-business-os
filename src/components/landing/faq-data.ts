/* FAQ copy: product and privacy questions on the landing page, billing
   questions on the pricing page, so each question appears in one place. Keep answers factual: the
   privacy answer mirrors app/privacy/page.tsx, and the billing answers
   mirror how subscriptions work in lib/subscription-access.ts. Public copy
   uses no hyphens. */

export type FaqItem = { q: string; a: string };
export type FaqGroup = { title: string; items: FaqItem[] };

export const PRICING_FAQ: FaqItem[] = [
  {
    q: "Do I need a credit card for the trial?",
    a: "No. Create your workspace and use every module free for 14 days without entering any payment details.",
  },
  {
    q: "What happens after the 14 days?",
    a: "If you haven't subscribed, the dashboard pauses until you do. Nothing is deleted, and everything is exactly where you left it.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel yourself from the Billing page in your dashboard, with no calls or emails needed.",
  },
];

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "Product",
    items: [
      {
        q: "What can the AI Copilot do?",
        a: "It answers questions about your live business data, such as which invoices are overdue, which deals might close this month or which products are running low, and it can draft actions like a task or a payment reminder.",
      },
      {
        q: "Will the AI change anything on its own?",
        a: "Never. Every action it proposes waits for an owner or admin to approve it first.",
      },
      {
        // Mirrors the quote flow in lib/actions/quotes.ts.
        q: "Can I send quotes before a customer orders?",
        a: "Yes. Build a quote from your products, change prices for a discount, and email it with a PDF attached. The customer can accept it online by typing their name, which turns it into an order and marks the deal as won.",
      },
      {
        // Mirrors the Sales report tab (app/dashboard/crm/report).
        q: "What does the sales report show?",
        a: "Your open pipeline and weighted forecast, value won and win rate, the deals that might close this month, and results per salesperson and per lead source. Owners and admins see the whole team; everyone else sees their own figures.",
      },
      {
        // Mirrors the customer import (lib/customer-import.ts).
        q: "Can I bring my customers over from another system?",
        a: "Yes. Owners and admins can import customers from a CSV file. AIBOS checks the file first and shows what will happen to each row, and skips anyone whose email is already on file.",
      },
      {
        // Mirrors the web lead form (app/f) and lead scoring (lib/lead-score.ts).
        q: "Can leads come straight from my website?",
        a: "Yes. Put the AIBOS contact form on your website or share its link. Each message becomes a lead with a reminder for the right person, and every customer gets a lead score so you know who to call first.",
      },
      {
        // Mirrors the WhatsApp button (components/crm/whatsapp-button.tsx).
        q: "Can I reach customers on WhatsApp?",
        a: "Yes. The WhatsApp button on a customer, deal or quote opens a chat with a ready written message, such as the quote with its link to accept online, and notes it on the customer's history.",
      },
      {
        // Mirrors email sequences (lib/sequence-runner.ts).
        q: "Can AIBOS follow up with leads for me?",
        a: "On Growth and up, yes. Write a few emails sent days apart and add customers to the sequence. It stops on its own when they reply or unsubscribe. Rules handle the next steps too, like a delivery reminder when a deal is won.",
      },
      {
        q: "Can I turn off modules I don't need?",
        a: "Yes. Switch off modules like Returns, Planning or EDI in settings and they leave the menu. Turn them back on whenever you like.",
      },
      {
        // Mirrors the Branches, Transfers and Profit by branch features and
        // the branch limits in lib/plans.ts.
        q: "Can I use AIBOS with several branches?",
        a: "Yes. Growth covers up to 3 branches, and on Enterprise you choose how many. Each branch keeps its own stock, orders and invoices, you can move stock between branches, staff can be limited to their own branch, and Reports compares profit per branch side by side.",
      },
    ],
  },
  {
    title: "Privacy and data",
    items: [
      {
        q: "Is my company's data private?",
        a: "Yes. It is kept separate from every other company, and we never sell it or use it to train AI models for other customers. When you ask the AI Copilot something, only the relevant parts go to our AI provider to answer you.",
      },
      {
        q: "Who can see payroll and accounting?",
        a: "Only owners and admins. Employees see the modules they work in, while HR, payroll, accounting and reports stay with the people running the business.",
      },
      {
        q: "Can I export my data?",
        a: "Anytime. Export any list as a CSV file, or download a full backup of your company's data from the dashboard.",
      },
    ],
  },
];
