"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui-dark/button";
import { Textarea } from "@/components/ui-dark/input";
import { fillWhatsApp, whatsappLink, WHATSAPP_TEMPLATES, type WhatsAppTemplateId } from "@/lib/whatsapp";
import { logWhatsApp, whatsappQuoteLink } from "@/lib/actions/whatsapp";
import { cn } from "@/lib/utils";

/**
 * Opens a WhatsApp chat with the customer, with a ready written message to
 * pick and edit first. The chat opens in WhatsApp itself (the app or
 * WhatsApp Web); the message is noted on the customer's history.
 */
export function WhatsAppButton({
  number,
  customerId,
  customerName,
  senderName,
  myCompany,
  dealId,
  quote,
  size = "sm",
  label = "WhatsApp",
}: {
  /** International digits, or null when there's no usable number. */
  number: string | null;
  customerId: string;
  customerName: string;
  senderName: string;
  myCompany: string;
  dealId?: string;
  /** On a quote page: offers the "Send the quote" message with its link. */
  quote?: { id: string; number: string };
  size?: "sm" | "md";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<WhatsAppTemplateId>(quote ? "quote" : "hello");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const vars = { name: customerName, senderName, myCompany, quoteLink: link, quoteNumber: quote?.number };
  const templates = WHATSAPP_TEMPLATES.filter((t) => !("needsQuote" in t) || quote);

  const choose = async (id: WhatsAppTemplateId) => {
    setTemplate(id);
    const t = WHATSAPP_TEMPLATES.find((x) => x.id === id)!;
    if (id === "quote" && quote && !link) {
      setBusy(true);
      const url = await whatsappQuoteLink(quote.id);
      setBusy(false);
      setLink(url);
      setText(fillWhatsApp(t.text, { ...vars, quoteLink: url }));
      return;
    }
    setText(fillWhatsApp(t.text, vars));
  };

  // The panel sits on top of the page (a portal), placed under the button
  // and kept inside the window, so cards and sidebars never cover it.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(352, window.innerWidth - 32);
      const left = Math.min(Math.max(16, r.right - width), window.innerWidth - width - 16);
      setPos({ top: r.bottom + 8, left: r.left + width <= window.innerWidth - 16 ? Math.max(16, r.left) : left });
    };
    place();
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  if (!number) {
    return (
      <span title="Add a mobile number to the customer to WhatsApp them">
        <Button type="button" variant="secondary" size={size} disabled>
          <MessageCircle className="h-4 w-4" />
          {label}
        </Button>
      </span>
    );
  }

  const send = async () => {
    // Opened straight away, inside the click, so the browser doesn't block it.
    const win = window.open(whatsappLink(number, text), "_blank");
    if (win) win.opener = null;
    setBusy(true);
    await logWhatsApp({ customerId, dealId, quoteId: template === "quote" ? quote?.id : null, number, message: text });
    setBusy(false);
    setOpen(false);
    if (!win) window.location.href = whatsappLink(number, text);
    router.refresh();
  };

  return (
    <div ref={anchor}>
      <Button
        type="button"
        variant="secondary"
        size={size}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open && !text) void choose(template);
        }}
      >
        <MessageCircle className="h-4 w-4 text-emerald-400" />
        {label}
      </Button>
      {open && pos && createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-label={`WhatsApp ${customerName}`}
          style={{ top: pos.top, left: pos.left }}
          className="app-text fixed z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-slate-900 p-4 shadow-2xl light:border-slate-200 light:bg-white"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-50 light:text-slate-900">WhatsApp {customerName.split(" ")[0]}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200 light:hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">+{number}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void choose(t.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  template === t.id
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 light:text-emerald-700"
                    : "border-white/10 text-slate-300 hover:border-white/25 light:border-slate-200 light:text-slate-600"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Textarea aria-label="Message" rows={5} value={text} onChange={(e) => setText(e.target.value)} className="mt-3 text-sm" />
          <Button type="button" onClick={send} disabled={busy} className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500">
            <MessageCircle className="h-4 w-4" />
            {busy ? "One moment..." : "Open in WhatsApp"}
          </Button>
          <p className="mt-2 text-xs leading-snug text-slate-500">You press send in WhatsApp. The message is noted on the customer&apos;s history.</p>
        </div>,
        document.body
      )}
    </div>
  );
}
