import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import type { OtpPurpose, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/error-handler.js";

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export async function createOtpCode(
  userId: string,
  purpose: OtpPurpose,
  client: PrismaClientLike = prisma,
) {
  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);
  const codeHash = await bcrypt.hash(code, 12);

  await client.otpCode.updateMany({
    where: { userId, purpose, status: "active" },
    data: { status: "expired" },
  });
  await client.otpCode.create({
    data: { userId, purpose, codeHash, expiresAt },
  });

  return { code, expiresAt };
}

export async function verifyAndConsumeOtpCode(
  userId: string,
  purpose: OtpPurpose,
  code: string,
  client: PrismaClientLike = prisma,
) {
  if (!/^\d{6}$/.test(code)) {
    throw new AppError(400, "A valid 6-digit code is required");
  }

  const record = await client.otpCode.findFirst({
    where: { userId, purpose, status: "active" },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true, expiresAt: true },
  });

  if (!record || record.expiresAt < new Date()) {
    if (record) {
      await client.otpCode.update({
        where: { id: record.id },
        data: { status: "expired" },
      });
    }
    throw new AppError(400, "Invalid or expired code");
  }

  const matches = await bcrypt.compare(code, record.codeHash);
  if (!matches) throw new AppError(400, "Invalid or expired code");

  await client.otpCode.update({
    where: { id: record.id },
    data: { status: "used", usedAt: new Date() },
  });
}
