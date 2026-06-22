import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

export function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export function codeExpiresAt(): Date {
  const d = new Date();
  d.setSeconds(d.getSeconds() + env.SECRET_CODE_TTL_HOURS * 3600);
  return d;
}

export async function storeCode(bookingId: string, code: string): Promise<void> {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { rawSecretCode: code, codeExpiresAt: codeExpiresAt() },
  });
}

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyCode(
  enteredCode: string,
  hashedCode: string,
): Promise<boolean> {
  return bcrypt.compare(enteredCode, hashedCode);
}

export async function invalidateCode(bookingId: string): Promise<void> {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { rawSecretCode: null, codeExpiresAt: new Date(0) },
  });
}

export async function isCodeExpired(bookingId: string): Promise<boolean> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { codeExpiresAt: true },
  });
  if (!booking?.codeExpiresAt) return true;
  return booking.codeExpiresAt < new Date();
}

export async function getRawCode(bookingId: string): Promise<string | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { rawSecretCode: true },
  });
  return booking?.rawSecretCode ?? null;
}
