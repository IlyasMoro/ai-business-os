import "server-only";
import Groq from "groq-sdk";
import { TOOL_DEFINITIONS, isKnownTool, isReadTool, runReadTool, proposeAiAction } from "@/lib/ai-tools";

const groq = new Groq();

const MODEL = "llama-3.3-70b-versatile";
const MAX_TOOL_ITERATIONS = 4;

export async function generateAssistantReply(
  companyName: string,
  companyId: string,
  userId: string,
  chatMessageId: string,
  snapshot: string,
  history: { role: "user" | "assistant"; content: string }[]
) {
  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are the AI assistant embedded in ${companyName}'s internal business operations dashboard (CRM, inventory, sales, invoicing, accounting, HR, payroll, projects, and support). Answer questions helpfully and concisely.

Here is a live snapshot of ${companyName}'s current data:
${snapshot}

Use this snapshot for high-level questions. For anything that needs specific records (a named customer, a specific ticket, which invoices are overdue, which projects exist), use the available tools instead of guessing.

You can also propose actions (creating a follow-up task, changing a ticket's status or priority, changing a customer's status) using the corresponding tools. These tools do NOT execute immediately — they submit a proposal that a human with the right permissions must approve before anything actually changes. When you call one of these tools, tell the user clearly that you've proposed the action and it's awaiting their approval. Never claim an action has been completed unless a tool result says so.

If asked about something not covered by the snapshot or tools, say you don't have access to that detail rather than guessing.`,
    },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
      });
    } catch {
      // Groq occasionally rejects a malformed tool call outright (400
      // tool_use_failed) instead of returning it for us to handle. Fall back
      // to a plain answer using whatever tool results we already gathered,
      // rather than failing the whole turn.
      const fallback = await groq.chat.completions.create({ model: MODEL, messages });
      return fallback.choices[0]?.message?.content ?? "";
    }

    const message = completion.choices[0]?.message;
    if (!message) return "";

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? "";
    }

    messages.push({
      role: "assistant",
      content: message.content ?? null,
      tool_calls: message.tool_calls,
    });

    for (const toolCall of message.tool_calls) {
      const name = toolCall.function.name;

      let args: unknown = {};
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        args = {};
      }

      let result: unknown;
      if (!isKnownTool(name)) {
        result = { error: `Unknown tool: ${name}` };
      } else if (isReadTool(name)) {
        result = await runReadTool(companyId, name, args);
      } else {
        result = await proposeAiAction(companyId, userId, chatMessageId, name, args);
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  return "I looked into that but hit my tool-use limit before finishing — could you rephrase or narrow the request?";
}
