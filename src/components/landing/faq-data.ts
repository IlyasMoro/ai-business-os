/* FAQ copy shared by the landing page and the pricing page, so the same
   question never gets two different answers. Keep answers factual: the
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
    q: "Is it priced per user?",
    a: "No. One flat $49 a month covers your whole company, however many people you invite.",
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
        a: "It answers questions about your live business data, such as which invoices are overdue or which products are running low, and it can draft actions like a task or a payment reminder.",
      },
      {
        q: "Will the AI change anything on its own?",
        a: "Never. Every action it proposes waits for an owner or admin to approve it first.",
      },
      {
        q: "Can I turn off modules I don't need?",
        a: "Yes. Switch off modules like Returns, Planning or EDI in settings and they leave the menu. Turn them back on whenever you like.",
      },
      {
        // Mirrors the Branches, Transfers and Profit by branch features;
        // no plan limits the number of branches.
        q: "Can I use AIBOS with several branches?",
        a: "Yes, and one plan covers your whole business however many branches you run. Each branch keeps its own stock, orders and invoices, you can move stock between branches, staff can be limited to their own branch, and Reports compares profit per branch side by side.",
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
  { title: "Billing", items: PRICING_FAQ },
];
