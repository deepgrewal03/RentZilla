import { ReplitConnectors } from "@replit/connectors-sdk";
import { randomUUID } from "node:crypto";

export class GmailDeliveryError extends Error {
  constructor(public readonly status?: number) {
    super("Gmail delivery unavailable");
    this.name = "GmailDeliveryError";
  }
}

export async function prepareGmailSender() {
  // A fresh SDK instance resolves current authorization; never cache OAuth tokens.
  const connectors = new ReplitConnectors();
  const connections = await connectors.listConnections({ connector_names: "google-mail" });
  if (connections.length !== 1 || connections[0].status !== "healthy") {
    throw new GmailDeliveryError();
  }
  return async (to: string, subject: string, html: string) => {
    // Exactly one mailbox, no header injection or additional recipients.
    if (!/^[^\s<>,;@\r\n]+@[^\s<>,;@\r\n]+\.[^\s<>,;@\r\n]+$/.test(to)) {
      throw new GmailDeliveryError();
    }
    const messageId = `<${randomUUID()}@rentzilla.invalid>`;
    const encodedBody = Buffer.from(html, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
    const mime = [
      // Gmail supplies the authenticated mailbox as From. Do not spoof the
      // legacy SMTP_FROM address, which may be a different Google account.
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodedBody,
    ].join("\r\n");
    // Sending is non-idempotent: never automatically retry an uncertain result.
    const response = await connectors.proxy("google-mail", "/gmail/v1/users/me/messages/send", {
      method: "POST",
      body: { raw: Buffer.from(mime, "utf8").toString("base64url") },
    });
    if (!response.ok) throw new GmailDeliveryError(response.status);
    const result = await response.json() as { id?: string };
    if (!result.id) throw new GmailDeliveryError();
    return { id: result.id, messageId };
  };
}
