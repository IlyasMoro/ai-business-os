"use client";

import { startTransition, useActionState, useEffect, useOptimistic, useRef } from "react";
import { ArrowUp, Check, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, type Tone } from "@/components/ui-dark/badge";
import { Button } from "@/components/ui-dark/button";
import { Markdown } from "./markdown";
import { sendChatMessage, approveAiAction, rejectAiAction } from "@/lib/actions/assistant";
import type { ChatMessageFormState } from "@/lib/validation/assistant";

type ActionStatus = "PENDING" | "APPROVED" | "EXECUTED" | "REJECTED" | "FAILED";

export type CopilotAction = { id: string; summary: string; status: ActionStatus };

export type CopilotMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  actions: CopilotAction[];
};

const statusTone: Record<ActionStatus, Tone> = {
  PENDING: "yellow",
  APPROVED: "green",
  EXECUTED: "green",
  REJECTED: "red",
  FAILED: "red",
};

const statusLabel: Record<ActionStatus, string> = {
  PENDING: "Waiting for approval",
  APPROVED: "Approved",
  EXECUTED: "Done",
  REJECTED: "Rejected",
  FAILED: "Failed",
};

const SUGGESTIONS = [
  "Which invoices are overdue?",
  "Who are my top customers?",
  "Which products are low on stock?",
  "Summarize this month's sales",
];

const MAX_LENGTH = 4000;

export function CopilotChat({
  messages,
  canDecide,
  companyName,
}: {
  messages: CopilotMessage[];
  canDecide: boolean;
  companyName: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Show the user's message the moment it is sent; the server round trip
  // (which includes the AI call) replaces it with the saved one.
  const [optimisticMessages, addOptimistic] = useOptimistic(
    messages,
    (current, content: string) => [
      ...current,
      { id: `pending-${current.length}`, role: "USER" as const, content, actions: [] },
    ]
  );

  const [state, sendAction, pending] = useActionState(
    async (prev: ChatMessageFormState, formData: FormData) => {
      const content = String(formData.get("content") ?? "");
      addOptimistic(content);
      const result = await sendChatMessage(prev, formData);
      // Sending failed (validation or rate limit): give the text back.
      if (result && inputRef.current && !inputRef.current.value) {
        inputRef.current.value = content;
        resizeInput();
      }
      return result;
    },
    undefined
  );

  const visible = optimisticMessages.filter((m) => m.role === "USER" || m.content.trim() !== "");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: visible.length > 1 ? "smooth" : "auto" });
  }, [visible.length, pending]);

  function resizeInput() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function submit(content: string) {
    const trimmed = content.trim();
    if (!trimmed || pending) return;
    const formData = new FormData();
    formData.set("content", trimmed);
    if (inputRef.current) {
      inputRef.current.value = "";
      resizeInput();
    }
    startTransition(() => sendAction(formData));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
          {visible.length === 0 ? (
            <Welcome companyName={companyName} onPick={submit} disabled={pending} />
          ) : (
            visible.map((message) =>
              message.role === "USER" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-blue-400/25 bg-blue-500/15 px-4 py-2.5 text-sm text-slate-50 light:border-blue-600/20 light:bg-blue-600/10 light:text-slate-900">
                    {message.content}
                  </div>
                </div>
              ) : (
                <AssistantMessage key={message.id} message={message} canDecide={canDecide} />
              )
            )
          )}
          {pending && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 light:border-slate-900/[0.06] sm:px-6">
        <form
          ref={formRef}
          className="mx-auto max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            submit(inputRef.current?.value ?? "");
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.04] p-2 backdrop-blur-md transition-colors focus-within:border-blue-500/60 focus-within:shadow-[0_0_0_3px_rgb(59_130_246/0.18)] light:border-slate-300 light:bg-white/70">
            <textarea
              ref={inputRef}
              name="content"
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder="Ask about your customers, sales, stock or team..."
              aria-label="Message the AI Copilot"
              onInput={resizeInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              className="max-h-[200px] min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-50 outline-none placeholder:text-slate-500 light:text-slate-900 light:placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={pending}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40 light:bg-blue-600 light:hover:bg-blue-700"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
          {(state?.errors?.content || state?.message) && (
            <p className="mt-2 text-sm text-red-400 light:text-red-600">
              {state?.errors?.content?.[0] ?? state?.message}
            </p>
          )}
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Enter to send, Shift and Enter for a new line. The Copilot can make mistakes, and every change it proposes waits for approval.
          </p>
        </form>
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-400/25 bg-blue-500/15 text-blue-300 light:border-blue-600/20 light:bg-blue-600/10 light:text-blue-700">
      <Sparkles className="h-4 w-4" />
    </div>
  );
}

function AssistantMessage({ message, canDecide }: { message: CopilotMessage; canDecide: boolean }) {
  return (
    <div className="flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 pt-1 text-sm text-slate-200 light:text-slate-800">
        <Markdown>{message.content}</Markdown>
        {message.actions.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.actions.map((action) => (
              <ActionCard key={action.id} action={action} canDecide={canDecide} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({ action, canDecide }: { action: CopilotAction; canDecide: boolean }) {
  const isPending = action.status === "PENDING";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
        isPending
          ? "border-amber-500/30 bg-amber-500/[0.06] light:border-amber-600/30 light:bg-amber-500/[0.08]"
          : "border-white/[0.08] bg-white/[0.03] light:border-slate-200 light:bg-white/60"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-50 light:text-slate-900">{action.summary}</p>
        <Badge tone={statusTone[action.status]} className="mt-1.5">
          {statusLabel[action.status]}
        </Badge>
      </div>
      {isPending &&
        (canDecide ? (
          <div className="flex shrink-0 gap-2">
            <form action={approveAiAction.bind(null, action.id)}>
              <Button type="submit" size="sm" variant="primary">
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
            </form>
            <form action={rejectAiAction.bind(null, action.id)}>
              <Button type="submit" size="sm" variant="secondary">
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
            </form>
          </div>
        ) : (
          <span className="shrink-0 text-xs text-slate-500">An owner or admin needs to approve this.</span>
        ))}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3" role="status" aria-label="The Copilot is thinking">
      <Avatar />
      <div className="flex items-center gap-1 pt-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 motion-reduce:animate-none light:bg-slate-500"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function Welcome({
  companyName,
  onPick,
  disabled,
}: {
  companyName: string;
  onPick: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center py-10 text-center sm:py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/25 bg-blue-500/15 text-blue-300 light:border-blue-600/20 light:bg-blue-600/10 light:text-blue-700">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-slate-50 light:text-slate-900">
        How can I help {companyName} today?
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-400 light:text-slate-500">
        Ask about your live business data, or ask me to do something like create a task or send a payment
        reminder. I will always ask before changing anything.
      </p>
      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onPick(prompt)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-white disabled:opacity-50 light:border-slate-200 light:bg-white/60 light:text-slate-700 light:hover:border-blue-600/30 light:hover:bg-blue-600/[0.06] light:hover:text-slate-900"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
