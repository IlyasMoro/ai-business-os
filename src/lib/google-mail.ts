import "server-only";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export type GmailAttachment = { filename: string; content: Buffer };

export async function sendGmailMessage({
  accessToken,
  from,
  to,
  subject,
  html,
  attachments,
}: {
  accessToken: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
}) {
  const raw = attachments && attachments.length > 0
    ? buildMultipartMessage({ from, to, subject, html, attachments })
    : [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        'Content-Type: text/html; charset="UTF-8"',
        "",
        html,
      ].join("\r\n");

  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64UrlEncode(raw) }),
  });

  if (!res.ok) {
    throw new Error(`Gmail send failed: ${await res.text()}`);
  }
}

/** Builds a multipart/mixed MIME message: an HTML body part plus one part
 * per attachment, base64-encoded. Gmail's API takes the whole thing as one
 * base64url "raw" blob — there's no separate attachments field like Resend's. */
function buildMultipartMessage({
  from,
  to,
  subject,
  html,
  attachments,
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments: GmailAttachment[];
}) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const parts = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ];

  for (const attachment of attachments) {
    parts.push(
      `--${boundary}`,
      "Content-Type: application/pdf",
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      attachment.content.toString("base64").replace(/(.{76})/g, "$1\r\n")
    );
  }
  parts.push(`--${boundary}--`);

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    ...parts,
  ].join("\r\n");
}
