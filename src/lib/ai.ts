import "server-only";
import Groq from "groq-sdk";

const groq = new Groq();

export async function generateAssistantReply(
  companyName: string,
  history: { role: "user" | "assistant"; content: string }[]
) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are the AI assistant embedded in ${companyName}'s internal business operations dashboard (CRM, inventory, sales, invoicing, accounting, HR, payroll, projects, and support). Answer questions helpfully and concisely.`,
      },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
  });

  return completion.choices[0]?.message?.content ?? "";
}
