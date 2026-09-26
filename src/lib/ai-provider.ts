import "server-only";
import OpenAI from "openai";
import type Groq from "groq-sdk";
import { getGroqClient } from "@/lib/groq-client";
import { db } from "@/lib/db";

// Groq's API is OpenAI-compatible (same request/response shape for chat
// completions and tool calls), so a completion built for Groq can be
// replayed against OpenAI almost unchanged when Groq itself is unreachable.
const OPENAI_FALLBACK_MODEL = "gpt-4o-mini";

/** The Groq model every AI feature uses. Groq retires models regularly (the
 * Llama 3.3 models this app started on are gone), so it lives in one place;
 * `openai/gpt-oss-120b` supports the tool calling the Copilot depends on. */
export const GROQ_MODEL = "openai/gpt-oss-120b";

type ChatCompletionParams = {
  model: string;
  messages: Groq.Chat.ChatCompletionMessageParam[];
  tools?: Groq.Chat.ChatCompletionTool[];
  tool_choice?: Groq.Chat.ChatCompletionToolChoiceOption;
  max_tokens?: number;
  /** gpt-oss is a reasoning model and its thinking counts toward max_tokens;
   * "low" keeps short classification calls fast and cheap. */
  reasoning_effort?: "low" | "medium" | "high";
};

export async function createChatCompletion(params: ChatCompletionParams): Promise<Groq.Chat.ChatCompletion> {
  const groq = await getGroqClient();

  try {
    return await groq.chat.completions.create(params);
  } catch (groqError) {
    const settings = await db.platformSettings.findUnique({ where: { id: "platform" } });
    const openaiApiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw groqError;
    }

    console.error("[ai-provider] Groq request failed, falling back to OpenAI:", groqError);
    const openai = new OpenAI({ apiKey: openaiApiKey });
    // gpt-4o-mini is not a reasoning model and rejects reasoning_effort.
    const { reasoning_effort: _unused, ...openaiParams } = params;
    void _unused;
    const completion = await openai.chat.completions.create({
      ...openaiParams,
      model: OPENAI_FALLBACK_MODEL,
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

    return completion as unknown as Groq.Chat.ChatCompletion;
  }
}
