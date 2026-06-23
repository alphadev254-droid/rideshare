import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { sendOtp } from "../../lib/sms.js";
import { createOtpCode, verifyAndConsumeOtpCode } from "../../lib/otp.js";
import { enqueueNotification } from "../../jobs/queue.js";
import { passwordResetCodeEmail, passwordResetCodeText, verificationCodeEmail, verificationCodeText } from "../../lib/email-templates.js";
import { AppError } from "../../middleware/error-handler.js";
import type { RegisterInput, LoginInput, VerifyOtpInput, RefreshInput, ForgotPasswordInput, ResetPasswordInput } from "./auth.schemas.js";


function findUserByIdentifier(identifier: string) {
  const value = identifier.trim();
  return value.includes("@")
    ? prisma.user.findUnique({ where: { email: value } })
    : prisma.user.findUnique({ where: { phone: value } });
}

export async function register(input: RegisterInput) {
  const { phone, email, fullName, password, role } = input;

  const [byPhone, byEmail] = await Promise.all([
    prisma.user.findUnique({ where: { phone } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (byPhone) throw new AppError(409, "Phone number already registered");
  if (byEmail) throw new AppError(409, "Email address already registered");

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { phone, email, fullName, passwordHash, role },
    select: { id: true, phone: true, email: true, fullName: true, role: true },
  });

  const { code } = await createOtpCode(user.id, "account_verification");
  await enqueueNotification({
    type: "otp",
    recipient: email,
    otp: code,
    html: verificationCodeEmail({ code, ttlMinutes: Math.round(300 / 60) }),
  });

  return { userId: user.id, message: "OTP sent to your email" };
}

export async function verifyOtp(input: VerifyOtpInput) {
  const { phone, otp } = input;

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, role: true, fullName: true, phone: true, email: true, isVerified: true, isActive: true, createdAt: true },
  });
  if (!user) throw new AppError(400, "Invalid or expired OTP");

  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  const updatedUser = await prisma.$transaction(async (tx) => {
    await verifyAndConsumeOtpCode(user.id, "account_verification", otp, tx);
    return tx.user.update({
      where: { phone },
      data: {
        isVerified: true,
        refreshToken,
        refreshTokenExpiresAt,
      },
      select: { id: true, role: true, fullName: true, phone: true, email: true, isVerified: true, isActive: true, createdAt: true },
    });
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return { accessToken, refreshToken, user: updatedUser };
}

export async function login(input: LoginInput) {
  const { identifier, password } = input;

  const isEmail = identifier.includes("@");
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: identifier } })
    : await prisma.user.findUnique({ where: { phone: identifier } });

  if (!user) throw new AppError(401, "Invalid credentials");
  if (!user.isActive) throw new AppError(403, "Account is deactivated");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, "Invalid credentials");

  if (!user.isVerified) {
    if (!user.email) throw new AppError(400, "No email on file — contact support");
    const { code } = await createOtpCode(user.id, "account_verification");
    await enqueueNotification({
      type: "otp",
      recipient: user.email,
      otp: code,
      html: verificationCodeEmail({ code, ttlMinutes: Math.round(300 / 60) }),
    });
    return { needsVerification: true as const, phone: user.phone };
  }

  const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken, refreshTokenExpiresAt },
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const userPayload = {
    id: user.id, phone: user.phone, email: user.email, fullName: user.fullName,
    role: user.role, isVerified: user.isVerified, isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
  return { accessToken, refreshToken, user: userPayload };
}


export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await findUserByIdentifier(input.identifier);
  const message = "If the account exists, a reset code has been sent to its email.";

  if (!user) return { message };
  if (user.role === "admin") throw new AppError(403, "Admin password reset is not allowed here");
  if (!user.isActive) throw new AppError(403, "Account is deactivated");
  if (!user.email) return { message };

  const { code } = await createOtpCode(user.id, "password_reset");
  const ttlMinutes = Math.round(300 / 60);
  await enqueueNotification({
    type: "email",
    to: user.email,
    subject: "Reset your RideShare password",
    text: passwordResetCodeText({ code, ttlMinutes }),
    html: passwordResetCodeEmail({ name: user.fullName, code, ttlMinutes }),
  });

  return { message };
}

export async function resetPassword(input: ResetPasswordInput) {
  const user = await findUserByIdentifier(input.identifier);
  if (!user) throw new AppError(400, "Invalid or expired reset code");
  if (user.role === "admin") throw new AppError(403, "Admin password reset is not allowed here");
  if (!user.isActive) throw new AppError(403, "Account is deactivated");

  const passwordHash = await bcrypt.hash(input.password, 12);
  await prisma.$transaction(async (tx) => {
    await verifyAndConsumeOtpCode(user.id, "password_reset", input.otp, tx);
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, refreshToken: null, refreshTokenExpiresAt: null },
    });
  });

  return { message: "Password reset successfully. You can now sign in." };
}

export async function refresh(input: RefreshInput) {
  let payload;
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { refreshToken: true, refreshTokenExpiresAt: true },
  });
  if (
    !user?.refreshToken ||
    user.refreshToken !== input.refreshToken ||
    (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date())
  ) {
    throw new AppError(401, "Refresh token revoked or expired");
  }

  const accessToken = signAccessToken({ sub: payload.sub, role: payload.role });
  return { accessToken };
}

export async function logout(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null, refreshTokenExpiresAt: null },
  });
}
