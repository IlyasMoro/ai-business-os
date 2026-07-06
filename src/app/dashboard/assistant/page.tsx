import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { ChatForm } from "@/components/assistant/chat-form";
import { clearChatHistory } from "@/lib/actions/assistant";

export default async function AssistantPage() {
  const session = await verifySession();

  const messages = await db.aiChatMessage.findMany({
    where: { companyId: session.companyId, userId: session.userId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">AI Assistant</h1>
          <p className="mt-1 text-sm text-slate-500">Ask questions about your business.</p>
        </div>
        {messages.length > 0 && (
          <DeleteButton
            action={clearChatHistory}
            confirmMessage="Clear the conversation?"
            label="Clear chat"
          />
        )}
      </div>

      <Card className="mt-6 flex h-[28rem] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-slate-500">
              Ask me anything about your customers, orders, invoices, or team.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "USER"
                    ? "ml-auto max-w-[80%] rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
                    : "mr-auto max-w-[80%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900"
                }
              >
                {message.content}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-slate-100 p-4">
          <ChatForm />
        </div>
      </Card>
    </div>
  );
}
