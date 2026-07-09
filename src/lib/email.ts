import "server-only";
import { Resend } from "resend";
import { db } from "@/lib/db";

async function getResendCredentials() {
  const settings = await db.platformSettings.findUnique({ where: { id: "platform" } });
  const apiKey = settings?.resendApiKey || process.env.RESEND_API_KEY;
  const from = settings?.resendFromEmail || process.env.RESEND_FROM_EMAIL;
  return { apiKey, from };
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const { apiKey, from } = await getResendCredentials();

  if (!apiKey) {
    throw new Error("No Resend API key configured (set it on the Platform Settings page, or RESEND_API_KEY).");
  }
  if (!from) {
    throw new Error("No Resend from-address configured (set it on the Platform Settings page, or RESEND_FROM_EMAIL).");
  }

  // Constructed lazily (not at module scope): the Resend SDK throws
  // synchronously at construction time if the key is missing, which would
  // otherwise break every module that imports this file — including ones
  // that never send an email — the moment it's loaded.
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
