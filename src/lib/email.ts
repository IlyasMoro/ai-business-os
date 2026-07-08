import "server-only";
import { Resend } from "resend";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }

  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL environment variable is not set");
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
