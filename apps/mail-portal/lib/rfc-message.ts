import type { SendMailInput } from "@mail-portal/types/mail";

export interface BuildRawMessageOptions {
  from: string;
  senderEmail: string;
  input: SendMailInput;
  messageId: string;
  /** Include Bcc header — only for the sender's Sent copy */
  includeBcc?: boolean;
  to?: string[];
  cc?: string[];
}

export function formatFromAddress(
  displayName: string | null,
  email: string
): string {
  if (displayName?.trim()) {
    const escaped = displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}" <${email}>`;
  }
  return email;
}

function encodeSubject(subject: string): string {
  const value = subject.trim() || "(No subject)";
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function formatAddressList(addresses: string[]): string {
  return addresses.map((a) => a.trim()).filter(Boolean).join(", ");
}

export function buildRawMessage(options: BuildRawMessageOptions): string {
  const {
    from,
    senderEmail,
    input,
    messageId,
    includeBcc = false,
  } = options;

  const to = options.to ?? input.to;
  const cc = options.cc ?? input.cc;
  const date = new Date().toUTCString();
  const hasAttachments = (input.attachments?.length ?? 0) > 0;
  const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers: string[] = [
    `Return-Path: <${senderEmail}>`,
    `MIME-Version: 1.0`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    `From: ${from}`,
    `Sender: ${from}`,
    `Reply-To: ${senderEmail}`,
    `To: ${formatAddressList(to)}`,
  ];

  if (cc?.length) {
    headers.push(`Cc: ${formatAddressList(cc)}`);
  }

  if (includeBcc && input.bcc?.length) {
    headers.push(`Bcc: ${formatAddressList(input.bcc)}`);
  }

  headers.push(`Subject: ${encodeSubject(input.subject ?? "")}`);

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`);
  }

  if (input.references?.length) {
    headers.push(`References: ${input.references.join(" ")}`);
  }

  if (input.priority === "high") {
    headers.push("X-Priority: 1");
  }

  if (input.requestReadReceipt) {
    headers.push(`Disposition-Notification-To: ${senderEmail}`);
  }

  const bodyParts: string[] = [];

  const appendTextPart = (boundary: string, isLast: boolean) => {
    if (input.text?.trim()) {
      bodyParts.push(`--${boundary}`);
      bodyParts.push("Content-Type: text/plain; charset=utf-8");
      bodyParts.push("Content-Transfer-Encoding: 8bit");
      bodyParts.push("");
      bodyParts.push(input.text);
      bodyParts.push("");
    }

    bodyParts.push(`--${boundary}`);
    bodyParts.push("Content-Type: text/html; charset=utf-8");
    bodyParts.push("Content-Transfer-Encoding: 8bit");
    bodyParts.push("");
    bodyParts.push(input.html || "");
    bodyParts.push("");
    bodyParts.push(`--${boundary}${isLast ? "--" : ""}`);
  };

  if (hasAttachments) {
    headers.push(
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
    );
    headers.push("");

    bodyParts.push(`--${mixedBoundary}`);
    bodyParts.push(
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`
    );
    bodyParts.push("");

    appendTextPart(altBoundary, true);
    bodyParts.push("");

    for (const att of input.attachments ?? []) {
      bodyParts.push(`--${mixedBoundary}`);
      bodyParts.push(
        `Content-Type: ${att.contentType}; name="${att.filename}"`
      );
      bodyParts.push("Content-Transfer-Encoding: base64");
      bodyParts.push(
        `Content-Disposition: attachment; filename="${att.filename}"`
      );
      bodyParts.push("");
      bodyParts.push(att.content);
      bodyParts.push("");
    }

    bodyParts.push(`--${mixedBoundary}--`);
  } else {
    headers.push(
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`
    );
    headers.push("");
    appendTextPart(altBoundary, true);
  }

  return [...headers, ...bodyParts].join("\r\n");
}
