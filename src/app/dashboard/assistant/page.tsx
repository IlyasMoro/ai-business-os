import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui-dark/card";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { Badge } from "@/components/ui-dark/badge";
import { Button } from "@/components/ui-dark/button";
import { ChatForm } from "@/components/assistant/chat-form";
import { clearChatHistory, approveAiAction, rejectAiAction } from "@/lib/actions/assistant";
import type { AiActionStatus } from "@/generated/prisma/enums";

const statusTone: Record<AiActionStatus, "yellow" | "green" | "red" | "slate"> = {
  PENDING: "yellow",
  APPROVED: "green",
  EXECUTED: "green",
  REJECTED: "red",
  FAILED: "red",
};

export default async function AssistantPage() {
  const session = await verifySession();
  const canDecide = hasRole(session, ["OWNER", "ADMIN"]);

  const [messages, pendingActions, allActions] = await Promise.all([
    db.aiChatMessage.findMany({
      where: { companyId: session.companyId, userId: session.userId },
      orderBy: { createdAt: "asc" },
    }),
    db.aiAction.findMany({
      where: { companyId: session.companyId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    db.aiAction.findMany({
      where: { companyId: session.companyId, chatMessageId: { not: null } },
      select: { chatMessageId: true, summary: true, status: true },
    }),
  ]);

  const actionsByMessageId = new Map<string, { summary: string; status: AiActionStatus }[]>();
  for (const action of allActions) {
    if (!action.chatMessageId) continue;
    const list = actionsByMessageId.get(action.chatMessageId) ?? [];
    list.push({ summary: action.summary, status: action.status });
    actionsByMessageId.set(action.chatMessageId, list);
  }

  return (
    <div className="-m-4 min-h-[calc(100%+2rem)] bg-black p-4 sm:-m-6 sm:p-6">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50">AI Copilot</h1>
            <p className="mt-1 text-sm text-slate-400">
              Ask questions about your business, or ask it to take action.
            </p>
          </div>
          {messages.length > 0 && (
            <DeleteButton
              action={clearChatHistory}
              confirmMessage="Clear the conversation?"
              label="Clear chat"
            />
          )}
        </div>

        {pendingActions.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Pending approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingActions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-white/[0.06] px-3 py-2"
                >
                  <p className="text-sm text-slate-50">{action.summary}</p>
                  {canDecide ? (
                    <div className="flex shrink-0 gap-2">
                      <form action={approveAiAction.bind(null, action.id)}>
                        <Button type="submit" size="sm" variant="primary">
                          Approve
                        </Button>
                      </form>
                      <form action={rejectAiAction.bind(null, action.id)}>
                        <Button type="submit" size="sm" variant="secondary">
                          Reject
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-500">Awaiting OWNER/ADMIN approval</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="mt-6 flex h-[28rem] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-slate-500">
                Ask me anything about your customers, orders, invoices, or team.
              </p>
            ) : (
              messages.map((message) => {
                const relatedActions = actionsByMessageId.get(message.id) ?? [];
                return (
                  <div
                    key={message.id}
                    className={message.role === "USER" ? "ml-auto max-w-[80%]" : "mr-auto max-w-[80%]"}
                  >
                    <div
                      className={
                        message.role === "USER"
                          ? "rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-100"
                          : "rounded-lg border border-white/[0.06] bg-slate-800/60 px-3 py-2 text-sm text-slate-50"
                      }
                    >
                      {message.content}
                    </div>
                    {relatedActions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {relatedActions.map((action, i) => (
                          <Badge key={i} tone={statusTone[action.status]}>
                            {action.summary} · {action.status.toLowerCase()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="border-t border-white/[0.06] p-4">
            <ChatForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
