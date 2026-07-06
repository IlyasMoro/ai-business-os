"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { generateAssistantReply } from "@/lib/ai";
import { ChatMessageSchema, type ChatMessageFormState } from "@/lib/validation/assistant";

export async function sendChatMessage(
  _state: ChatMessageFormState,
  formData: FormData
): Promise<ChatMessageFormState> {
  const session = await verifySession();

  const validated = ChatMessageSchema.safeParse({
    content: formData.get("content"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { content } = validated.data;

  await db.aiChatMessage.create({
    data: {
      role: "USER",
      content,
      companyId: session.companyId,
      userId: session.userId,
    },
  });

  const history = await db.aiChatMessage.findMany({
    where: { companyId: session.companyId, userId: session.userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  const company = await db.company.findUnique({
    where: { id: session.companyId },
    select: { name: true },
  });

  try {
    const reply = await generateAssistantReply(
      company?.name ?? "the company",
      history.map((message) => ({
        role: message.role === "USER" ? "user" : "assistant",
        content: message.content,
      }))
    );

    await db.aiChatMessage.create({
      data: {
        role: "ASSISTANT",
        content: reply || "I couldn't generate a response. Please try again.",
        companyId: session.companyId,
        userId: session.userId,
      },
    });
  } catch {
    await db.aiChatMessage.create({
      data: {
        role: "ASSISTANT",
        content: "Sorry, I ran into an error reaching the assistant. Please try again.",
        companyId: session.companyId,
        userId: session.userId,
      },
    });
  }

  revalidatePath("/dashboard/assistant");
  return undefined;
}

export async function clearChatHistory() {
  const session = await verifySession();

  await db.aiChatMessage.deleteMany({
    where: { companyId: session.companyId, userId: session.userId },
  });

  revalidatePath("/dashboard/assistant");
}
