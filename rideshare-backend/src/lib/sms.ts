import { createRequire } from "module";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

type AfricaTalkingClient = {
  SMS: {
    send(params: { to: string[]; message: string; from?: string }): Promise<unknown>;
  };
};

const require = createRequire(import.meta.url);
let smsClient: AfricaTalkingClient | null | undefined;

function getTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

function isEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getSmsClient() {
  if (smsClient !== undefined) return smsClient;
  if (!env.AT_API_KEY || env.AT_API_KEY === "your_africastalking_api_key") {
    smsClient = null;
    return smsClient;
  }

  const africastalking = require("africastalking") as (config: {
    apiKey: string;
    username: string;
  }) => AfricaTalkingClient;

  smsClient = africastalking({
    apiKey: env.AT_API_KEY,
    username: env.AT_USERNAME,
  });
  return smsClient;
}

function normalizePhoneForSms(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return `+${trimmed.replace(/\D/g, "")}`;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  const defaultCountryDigits = env.SMS_DEFAULT_COUNTRY_CODE.replace(/\D/g, "");
  if (digits.startsWith("0")) return `+${defaultCountryDigits}${digits.slice(1)}`;
  if (digits.startsWith(defaultCountryDigits)) return `+${digits}`;
  return `+${defaultCountryDigits}${digits}`;
}

async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  if (!isEmailAddress(to)) {
    console.warn(`[EMAIL] Skipped invalid email recipient: ${to || "(empty)"}`);
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.log("\n[EMAIL - not configured, logging instead]");
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:    ${text}\n`);
    return;
  }

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      sender: env.SMTP_USER,
      envelope: { from: env.SMTP_USER, to },
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    });
  } catch (err) {
    console.error(`[EMAIL] Failed to send to ${to}:`, (err as Error).message);
    console.log("\n[EMAIL - send failed, logging instead]");
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body:    ${text}\n`);
  }
}

async function sendSms(phone: string, message: string): Promise<void> {
  const to = normalizePhoneForSms(phone);
  if (!to) {
    console.warn("[SMS] Skipped empty phone recipient");
    return;
  }

  const client = getSmsClient();
  if (!client) {
    console.log("\n[SMS - not configured, logging instead]");
    console.log(`   To:   ${to}`);
    console.log(`   Body: ${message}\n`);
    return;
  }

  try {
    await client.SMS.send({
      to: [to],
      message,
      from: env.AT_SENDER_ID || undefined,
    });
  } catch (err) {
    console.error(`[SMS] Failed to send to ${to}:`, (err as Error).message);
    console.log("\n[SMS - send failed, logging instead]");
    console.log(`   To:   ${to}`);
    console.log(`   Body: ${message}\n`);
  }
}

export async function sendCustomEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  await sendEmail(to, subject, text, html);
}

export async function sendOtp(recipient: string, otp: string): Promise<void> {
  const message = `Your RideShare verification code is ${otp}. Valid for 5 minutes. Do not share this code.`;
  if (isEmailAddress(recipient)) {
    await sendEmail(recipient, "Your RideShare verification code", message);
    return;
  }

  await sendSms(recipient, message);
}

export async function sendSecretCode(
  phone: string,
  code: string,
  driverName: string,
  route: string,
): Promise<void> {
  await sendSms(
    phone,
    `RideShare boarding code: ${code}\nDriver: ${driverName}\nRoute: ${route}\nShare ONLY with your driver at boarding.`,
  );
}

export async function sendEmergencyAlert(
  phone: string,
  passengerName: string,
  route: string,
  tripId: string,
): Promise<void> {
  await sendSms(
    phone,
    `ALERT: ${passengerName} has started a RideShare trip on route ${route}. Trip ID: ${tripId}. This is an automated safety notification.`,
  );
}
