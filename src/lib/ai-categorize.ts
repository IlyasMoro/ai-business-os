import "server-only";
import Groq from "groq-sdk";

const groq = new Groq();
const MODEL = "llama-3.3-70b-versatile";

export async function suggestTransactionCategory(
  description: string,
  type: "INCOME" | "EXPENSE",
  existingCategories: string[]
): Promise<string> {
  const preferExisting =
    existingCategories.length > 0
      ? ` Prefer reusing one of these existing categories if it genuinely fits: ${existingCategories.join(", ")}.`
      : "";

  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `Suggest a short (1-3 word) accounting category for this ${type.toLowerCase()} transaction description: "${description}".${preferExisting} Reply with ONLY the category name, nothing else.`,
      },
    ],
    max_tokens: 20,
  });

  const suggestion = completion.choices[0]?.message?.content?.trim() ?? "";
  return suggestion.replace(/^["'.]+|["'.]+$/g, "").slice(0, 60);
}

export async function suggestTicketPriority(
  subject: string,
  description: string
): Promise<"LOW" | "MEDIUM" | "HIGH" | null> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `A customer support ticket has this subject: "${subject}" and description: "${description}". Classify its urgency as exactly one word: LOW, MEDIUM, or HIGH. Reply with ONLY that word.`,
      },
    ],
    max_tokens: 5,
  });

  const raw = completion.choices[0]?.message?.content?.trim().toUpperCase() ?? "";
  if (raw.includes("HIGH")) return "HIGH";
  if (raw.includes("LOW")) return "LOW";
  if (raw.includes("MEDIUM")) return "MEDIUM";
  return null;
}
