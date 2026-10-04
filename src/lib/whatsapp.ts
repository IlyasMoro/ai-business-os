/* WhatsApp click to chat: turning a stored phone number into the
   international form wa.me needs, and the ready written messages. No
   database or network access here. */

/**
 * The number as digits with the country code, or null when it can't be a
 * real mobile number. "082 123 4567" with country code 27 becomes
 * "27821234567"; "+44 7700 900123" and "0044 7700 900123" keep their own.
 */
export function whatsappNumber(phone: string | null | undefined, countryCode: string): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    // Already international.
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = countryCode.replace(/\D/g, "") + digits.slice(1);
  } else if (!digits.startsWith(countryCode.replace(/\D/g, ""))) {
    // A bare local number without its leading 0.
    digits = countryCode.replace(/\D/g, "") + digits;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}${text.trim() ? `?text=${encodeURIComponent(text.trim())}` : ""}`;
}

export type WhatsAppVars = { name: string; senderName: string; myCompany: string; quoteLink?: string | null; quoteNumber?: string | null };

export const WHATSAPP_TEMPLATES = [
  {
    id: "hello",
    label: "Say hello",
    text: "Hi {{first_name}}, it's {{sender_name}} from {{my_company}}. ",
  },
  {
    id: "follow-up",
    label: "Follow up",
    text: "Hi {{first_name}}, {{sender_name}} from {{my_company}} here. Just checking in on our last conversation. Is there anything I can help with?",
  },
  {
    id: "quote",
    label: "Send the quote",
    text: "Hi {{first_name}}, here is your quote {{quote_number}} from {{my_company}}. You can view and accept it here: {{quote_link}}",
    needsQuote: true,
  },
] as const;

export type WhatsAppTemplateId = (typeof WHATSAPP_TEMPLATES)[number]["id"];

/** Fills a template's placeholders; anything unknown is removed. */
export function fillWhatsApp(text: string, vars: WhatsAppVars): string {
  const values: Record<string, string> = {
    first_name: vars.name.trim().split(/\s+/)[0] || vars.name,
    name: vars.name,
    sender_name: vars.senderName,
    my_company: vars.myCompany,
    quote_link: vars.quoteLink ?? "",
    quote_number: vars.quoteNumber ?? "",
  };
  return text
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => values[key.toLowerCase()] ?? "")
    .replace(/ {2,}/g, " ");
}
