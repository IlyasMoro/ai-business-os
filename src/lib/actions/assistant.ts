"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { generateAssistantReply } from "@/lib/ai";
import { getBusinessSnapshot, formatSnapshotForPrompt } from "@/lib/business-snapshot";
import { ChatMessageSchema, type ChatMessageFormState } from "@/lib/validation/assistant";
import { TicketStatusValues, TicketPriorityValues } from "@/lib/validation/support";
import { CustomerStatusValues } from "@/lib/validation/ai-actions";

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

  const [company, snapshot] = await Promise.all([
    db.company.findUnique({
      where: { id: session.companyId },
      select: { name: true },
    }),
    getBusinessSnapshot(session.companyId),
  ]);

  // Created up front (with placeholder content) so any actions the assistant
  // proposes while generating this reply can link back to the message that
  // spawned them.
  const assistantMessage = await db.aiChatMessage.create({
    data: {
      role: "ASSISTANT",
      content: "",
      companyId: session.companyId,
      userId: session.userId,
    },
  });

  let finalContent: string;
  try {
    finalContent =
      (await generateAssistantReply(
        company?.name ?? "the company",
        session.companyId,
        session.userId,
        assistantMessage.id,
        formatSnapshotForPrompt(snapshot),
        history.map((message) => ({
          role: message.role === "USER" ? "user" : "assistant",
          content: message.content,
        }))
      )) || "I couldn't generate a response. Please try again.";
  } catch {
    finalContent = "Sorry, I ran into an error reaching the assistant. Please try again.";
  }

  await db.aiChatMessage.update({
    where: { id: assistantMessage.id },
    data: { content: finalContent },
  });

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

async function executeAiAction(
  companyId: string,
  type: string,
  input: string
): Promise<{ result?: unknown; error?: string }> {
  const args = JSON.parse(input);

  switch (type) {
    case "CREATE_TASK": {
      const task = await db.task.create({
        data: {
          title: args.title,
          description: args.description || undefined,
          dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
          projectId: args.projectId,
        },
      });
      return { result: { taskId: task.id } };
    }
    case "UPDATE_TICKET_STATUS": {
      if (!TicketStatusValues.includes(args.status)) {
        return { error: "Invalid ticket status." };
      }
      await db.ticket.update({
        where: { id: args.ticketId, companyId },
        data: { status: args.status },
      });
      return { result: { ticketId: args.ticketId, status: args.status } };
    }
    case "UPDATE_TICKET_PRIORITY": {
      if (!TicketPriorityValues.includes(args.priority)) {
        return { error: "Invalid ticket priority." };
      }
      await db.ticket.update({
        where: { id: args.ticketId, companyId },
        data: { priority: args.priority },
      });
      return { result: { ticketId: args.ticketId, priority: args.priority } };
    }
    case "UPDATE_CUSTOMER_STATUS": {
      if (!CustomerStatusValues.includes(args.status)) {
        return { error: "Invalid customer status." };
      }
      await db.customer.update({
        where: { id: args.customerId, companyId },
        data: { status: args.status },
      });
      return { result: { customerId: args.customerId, status: args.status } };
    }
    default:
      return { error: `Unknown action type: ${type}` };
  }
}

export async function approveAiAction(actionId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/assistant?error=forbidden");
  }

  const action = await db.aiAction.findUnique({
    where: { id: actionId, companyId: session.companyId },
  });
  if (!action || action.status !== "PENDING") {
    return;
  }

  try {
    const { result, error } = await executeAiAction(session.companyId, action.type, action.input);
    await db.aiAction.update({
      where: { id: actionId },
      data: {
        status: error ? "FAILED" : "EXECUTED",
        error: error ?? null,
        result: result ? JSON.stringify(result) : null,
        decidedByUserId: session.userId,
        decidedAt: new Date(),
        executedAt: new Date(),
      },
    });
  } catch (err) {
    await db.aiAction.update({
      where: { id: actionId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : "Unknown error while executing the action.",
        decidedByUserId: session.userId,
        decidedAt: new Date(),
        executedAt: new Date(),
      },
    });
  }

  revalidatePath("/dashboard/assistant");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/support");
  revalidatePath("/dashboard/crm");
}

export async function rejectAiAction(actionId: string) {
  const session = await verifySession();

  if (!hasRole(session, ["OWNER", "ADMIN"])) {
    redirect("/dashboard/assistant?error=forbidden");
  }

  const action = await db.aiAction.findUnique({
    where: { id: actionId, companyId: session.companyId },
  });
  if (!action || action.status !== "PENDING") {
    return;
  }

  await db.aiAction.update({
    where: { id: actionId },
    data: {
      status: "REJECTED",
      decidedByUserId: session.userId,
      decidedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/assistant");
}
