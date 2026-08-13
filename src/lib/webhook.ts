import "server-only";

const TIMEOUT_MS = 8000;

/** Posts a JSON notification to a company's configured outgoing webhook.
 * The "text" field makes the payload work as-is against a Slack Incoming
 * Webhook URL; everything else is extra context for a generic consumer
 * (Zapier, Make, a custom endpoint). Never throws — a notification failing
 * must never break the business operation that triggered it. */
export async function sendWebhookNotification(
  webhookUrl: string | null | undefined,
  summary: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  if (!webhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: summary, timestamp: new Date().toISOString(), ...data }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("[webhook] notification failed:", err);
  } finally {
    clearTimeout(timeout);
  }
}
