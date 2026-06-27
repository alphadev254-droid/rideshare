import { env } from "../../config/env.js";
import { sendCustomEmail } from "../../lib/sms.js";
import type { ContactMessageInput } from "./contact.schemas.js";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendContactMessage(input: ContactMessageInput) {
  const to = env.CONTACT_EMAIL || "info@chepetsaride.com";
  const subject = `[ChepetsaRide Contact] ${input.subject}`;
  const text = [
    "New contact message from ChepetsaRide website",
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Subject: ${input.subject}`,
    "",
    input.message,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;">
      <h2 style="margin:0 0 12px;">New contact message</h2>
      <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>
      <div style="margin-top:16px;padding:14px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;white-space:pre-wrap;">${escapeHtml(input.message)}</div>
    </div>
  `;

  await sendCustomEmail(to, subject, text, html);
  return { sent: true, email: to };
}
