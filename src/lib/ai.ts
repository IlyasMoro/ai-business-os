import "server-only";
import Groq from "groq-sdk";

const groq = new Groq();

export async function generateAssistantReply(
  companyName: string,
  snapshot: string,
  history: { role: "user" | "assistant"; content: string }[]
) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are the AI assistant embedded in ${companyName}'s internal business operations dashboard (CRM, inventory, sales, invoicing, accounting, HR, payroll, projects, and support). Answer questions helpfully and concisely.

Here is a live snapshot of ${companyName}'s current data:
${snapshot}

Use this snapshot when answering questions about the current state of the business (e.g. customer counts, open orders, low stock, outstanding invoices, open tickets, active projects). If asked about something not covered by the snapshot, say you don't have access to that detail rather than guessing.`,
      },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
  });

  return completion.choices[0]?.message?.content ?? "";
}
