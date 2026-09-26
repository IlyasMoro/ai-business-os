import { verifySession, hasRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { DeleteButton } from "@/components/ui-dark/delete-button";
import { Button } from "@/components/ui-dark/button";
import { CopilotChat, type CopilotMessage, type CopilotAction } from "@/components/assistant/copilot-chat";
import { clearChatHistory, approveAiAction, rejectAiAction } from "@/lib/actions/assistant";

export default async function AssistantPage() {
  const session = await verifySession();
  const canDecide = hasRole(session, ["OWNER", "ADMIN"]);

  const [messages, pendingActions, company] = await Promise.all([
    db.aiChatMessage.findMany({
      where: { companyId: session.companyId, userId: session.userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        aiActions: { select: { id: true, summary: true, status: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    db.aiAction.findMany({
      where: { companyId: session.companyId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, summary: true, chatMessageId: true },
    }),
    db.company.findUnique({ where: { id: session.companyId }, select: { name: true } }),
  ]);

  const chatMessages: CopilotMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    actions: m.aiActions as CopilotAction[],
  }));

  // Actions are company wide but chats are per user, so an action another
  // teammate's chat proposed never appears inline here. List those (and any
  // not tied to a chat) up top so owners and admins can still decide on them.
  const ownMessageIds = new Set(messages.map((m) => m.id));
  const otherPending = pendingActions.filter((a) => !a.chatMessageId || !ownMessageIds.has(a.chatMessageId));

  return (
    <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col sm:-m-6">
      <div className="border-b border-white/[0.06] px-4 py-4 light:border-slate-900/[0.06] sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-50 light:text-slate-900">AI Copilot</h1>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-500">
              Ask questions about your business, or ask it to take action.
            </p>
          </div>
          {chatMessages.length > 0 && (
            <DeleteButton action={clearChatHistory} confirmMessage="Clear the conversation?" label="Clear chat" />
          )}
        </div>

        {canDecide && otherPending.length > 0 && (
          <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 light:border-amber-600/30 light:bg-amber-500/[0.08]">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300 light:text-amber-700">
              Waiting for approval from your team&apos;s chats ({otherPending.length})
            </p>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {otherPending.map((action) => (
                <li key={action.id} className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-50 light:text-slate-900">{action.summary}</p>
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
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CopilotChat messages={chatMessages} canDecide={canDecide} companyName={company?.name ?? "your business"} />
    </div>
  );
}
