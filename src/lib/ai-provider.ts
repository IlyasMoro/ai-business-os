import "server-only";
import OpenAI from "openai";
import type Groq from "groq-sdk";
import { getGroqClient } from "@/lib/groq-client";
import { db } from "@/lib/db";

// Groq's API is OpenAI-compatible (same request/response shape for chat
// completions and tool calls), so a completion built for Groq can be
// replayed against OpenAI almost unchanged when Groq itself is unreachable.
const OPENAI_FALLBACK_MODEL = "gpt-4o-mini";

type ChatCompletionParams = {
  model: string;
  messages: Groq.Chat.ChatCompletionMessageParam[];
  tools?: Groq.Chat.ChatCompletionTool[];
  tool_choice?: Groq.Chat.ChatCompletionToolChoiceOption;
  max_tokens?: number;
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
    const completion = await openai.chat.completions.create({
      ...params,
      model: OPENAI_FALLBACK_MODEL,
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

    return completion as unknown as Groq.Chat.ChatCompletion;
  }
}
