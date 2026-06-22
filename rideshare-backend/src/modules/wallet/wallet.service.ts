import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/error-handler.js";
import { enqueueNotification, enqueueWithdrawal, enqueueWithdrawalTimeout } from "../../jobs/queue.js";
import { createOtpCode, verifyAndConsumeOtpCode } from "../../lib/otp.js";
import { withdrawalCodeEmail, withdrawalCodeText } from "../../lib/email-templates.js";
import { calculateWithdrawalFee, initiatePaychanguWithdrawalPayout } from "../../lib/paychangu.js";

type WalletLedgerInput = {
  driverId: string;
  type: "credit" | "withdrawal";
  kind:
    | "trip_payout_credit"
    | "refund_convenience_credit"
    | "withdrawal_debit"
    | "admin_adjustment_credit"
    | "admin_adjustment_debit";
  amountMwk: bigint;
  bookingId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
  reference?: string | null;
  metadata?: Prisma.InputJsonValue;
  countAsEarnings?: boolean;
};

function describeWalletTx(tx: {
  type: "credit" | "withdrawal";
  kind: string | null;
  reference: string | null;
}) {
  switch (tx.kind) {
    case "trip_payout_credit":
      return "Trip payout";
    case "refund_convenience_credit":
      return "Refund convenience fee";
    case "withdrawal_debit":
      return tx.reference ?? "Withdrawal";
    case "admin_adjustment_credit":
    case "admin_adjustment_debit":
      return tx.reference ?? "Admin adjustment";
    default:
      return tx.type === "credit" ? "Fare received" : (tx.reference ?? "Withdrawal");
  }
}

export async function createWalletLedgerEntry(
  client: Prisma.TransactionClient,
  input: WalletLedgerInput,
) {
  if (input.amountMwk <= 0n) {
    throw new AppError(400, "Wallet transaction amount must be greater than zero");
  }

  const wallet = await client.driverWallet.upsert({
    where: { driverId: input.driverId },
    update: {},
    create: { driverId: input.driverId },
    select: { balanceMwk: true, totalEarnedMwk: true },
  });

  const balanceBefore = wallet.balanceMwk;
  const balanceAfter =
    input.type === "credit"
      ? balanceBefore + input.amountMwk
      : balanceBefore - input.amountMwk;

  if (balanceAfter < 0n) throw new AppError(400, "Insufficient balance");

  if (input.type === "credit") {
    await client.driverWallet.update({
      where: { driverId: input.driverId },
      data: {
        balanceMwk: { increment: input.amountMwk },
        ...(input.countAsEarnings !== false
          ? { totalEarnedMwk: { increment: input.amountMwk } }
          : {}),
      },
    });
  } else {
    const updated = await client.driverWallet.updateMany({
      where: { driverId: input.driverId, balanceMwk: { gte: input.amountMwk } },
      data: { balanceMwk: { decrement: input.amountMwk } },
    });
    if (updated.count === 0) throw new AppError(400, "Insufficient balance");
  }

  return client.walletTransaction.create({
    data: {
      driverId: input.driverId,
      type: input.type,
      kind: input.kind,
      amountMwk: input.amountMwk,
      balanceBeforeMwk: balanceBefore,
      balanceAfterMwk: balanceAfter,
      bookingId: input.bookingId ?? null,
      paymentId: input.paymentId ?? null,
      refundId: input.refundId ?? null,
      reference: input.reference ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function getBalance(userId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");

  const [credits, debits] = await Promise.all([
    prisma.walletTransaction.aggregate({
      where: { driverId: driver.id, type: "credit" },
      _sum: { amountMwk: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { driverId: driver.id, type: "withdrawal" },
      _sum: { amountMwk: true },
    }),
  ]);

  const totalEarnedMwk = credits._sum.amountMwk ?? 0n;
  const withdrawnMwk = debits._sum.amountMwk ?? 0n;
  const balanceMwk = totalEarnedMwk - withdrawnMwk;

  return {
    balanceMwk: balanceMwk.toString(),
    totalEarnedMwk: totalEarnedMwk.toString(),
  };
}

export async function getWithdrawalById(userId: string, withdrawalId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");

  const w = await prisma.walletWithdrawalRequest.findFirst({
    where: { id: withdrawalId, driverId: driver.id },
    select: {
      id: true,
      amountMwk: true,
      phone: true,
      provider: true,
      status: true,
      reference: true,
      failureReason: true,
      createdAt: true,
      processedAt: true,
      walletTx: {
        select: {
          id: true,
          balanceBeforeMwk: true,
          balanceAfterMwk: true,
          createdAt: true,
        },
      },
    },
  });
  if (!w) throw new AppError(404, "Withdrawal not found");

  return {
    id: w.id,
    amountMwk: w.amountMwk.toString(),
    phone: w.phone,
    provider: w.provider,
    status: w.status,
    reference: w.reference,
    failureReason: w.failureReason,
    createdAt: w.createdAt,
    processedAt: w.processedAt,
    walletTransactionId: w.walletTx?.id ?? null,
    balanceBeforeMwk: w.walletTx?.balanceBeforeMwk?.toString() ?? null,
    balanceAfterMwk: w.walletTx?.balanceAfterMwk?.toString() ?? null,
  };
}

export async function getWithdrawals(userId: string, page = 1, limit = 20) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");

  const withdrawals = await prisma.walletWithdrawalRequest.findMany({
    where: { driverId: driver.id },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      amountMwk: true,
      phone: true,
      provider: true,
      status: true,
      reference: true,
      failureReason: true,
      createdAt: true,
      processedAt: true,
      walletTx: {
        select: {
          id: true,
          balanceBeforeMwk: true,
          balanceAfterMwk: true,
          createdAt: true,
        },
      },
    },
  });

  return withdrawals.map((w) => ({
    id: w.id,
    amountMwk: w.amountMwk.toString(),
    phone: w.phone,
    provider: w.provider,
    status: w.status,
    reference: w.reference,
    failureReason: w.failureReason,
    createdAt: w.createdAt,
    processedAt: w.processedAt,
    walletTransactionId: w.walletTx?.id ?? null,
    balanceBeforeMwk: w.walletTx?.balanceBeforeMwk?.toString() ?? null,
    balanceAfterMwk: w.walletTx?.balanceAfterMwk?.toString() ?? null,
  }));
}

export async function getTransactions(userId: string, page = 1, limit = 20) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  const txs = await prisma.walletTransaction.findMany({
    where: { driver: { userId } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      type: true,
      kind: true,
      amountMwk: true,
      balanceBeforeMwk: true,
      balanceAfterMwk: true,
      bookingId: true,
      paymentId: true,
      refundId: true,
      reference: true,
      createdAt: true,
    },
  });
  return txs.map((t) => ({
    id: t.id,
    type: t.type,
    kind: t.kind,
    amountMwk: t.amountMwk.toString(),
    balanceBeforeMwk: t.balanceBeforeMwk?.toString() ?? null,
    balanceAfterMwk: t.balanceAfterMwk?.toString() ?? null,
    bookingId: t.bookingId,
    paymentId: t.paymentId,
    refundId: t.refundId,
    description: describeWalletTx(t),
    createdAt: t.createdAt,
  }));
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

export async function requestWithdrawalOtp(userId: string) {
  console.log(`[WITHDRAW] OTP requested by user ${userId}`);

  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      isApproved: true,
      user: { select: { id: true, email: true } },
    },
  });
  if (!driver || !driver.isApproved) {
    console.warn(`[WITHDRAW] OTP request denied — driver ${userId} not found or not approved`);
    throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  }
  if (!driver.user.email) throw new AppError(400, "No email is available for withdrawal verification");

  const { code, expiresAt } = await createOtpCode(driver.user.id, "withdrawal");
  console.log(`[WITHDRAW] OTP code generated for driver ${driver.id}, expires at ${expiresAt.toISOString()}`);

  const ttlMinutes = Math.round(env.OTP_TTL_SECONDS / 60);
  await enqueueNotification({
    type: "email",
    to: driver.user.email,
    subject: "Your RideShare withdrawal code",
    text: withdrawalCodeText({ code, ttlMinutes }),
    html: withdrawalCodeEmail({ code, ttlMinutes }),
  });
  console.log(`[WITHDRAW] OTP email queued to ${maskEmail(driver.user.email)}`);

  return {
    sent: true,
    email: maskEmail(driver.user.email),
    expiresAt,
    message: "Withdrawal verification code sent",
  };
}

export async function requestWithdrawal(
  userId: string,
  amountMwk: number,
  phone: string,
  provider: string,
  otp: string,
) {
  console.log(`[WITHDRAW] Request by user ${userId} — amount=${amountMwk} MWK, provider=${provider}, phone=${phone}`);
  if (!Number.isFinite(amountMwk) || amountMwk <= 0) {
    console.warn(`[WITHDRAW] Invalid amount ${amountMwk} from user ${userId}`);
    throw new AppError(400, "Withdrawal amount must be greater than zero");
  }
  if (!/^\d{6}$/.test(otp)) {
    throw new AppError(400, "A valid 6-digit withdrawal code is required");
  }

  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      isApproved: true,
      wallet: true,
      user: { select: { id: true, email: true } },
    },
  });
  if (!driver || !driver.isApproved) {
    console.warn(`[WITHDRAW] Request denied — driver ${userId} not found or not approved`);
    throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  }
  if (!driver.user.email) throw new AppError(400, "No email is available for withdrawal verification");

  if (!driver.wallet) throw new AppError(404, "Driver wallet not found");
  // This is a fast user-facing check. The queued worker repeats the check atomically.
  if (Number(driver.wallet.balanceMwk) < amountMwk) {
    console.warn(`[WITHDRAW] Insufficient balance for driver ${driver.id}: need=${amountMwk}, available=${driver.wallet.balanceMwk}`);
    throw new AppError(400, "Insufficient balance");
  }

  const ref = `WD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const request = await prisma.$transaction(async (tx) => {
    await verifyAndConsumeOtpCode(driver.user.id, "withdrawal", otp, tx);
    return tx.walletWithdrawalRequest.create({
      data: {
        driverId: driver.id,
        amountMwk: BigInt(amountMwk),
        phone,
        provider,
        reference: ref,
      },
      select: { id: true, amountMwk: true, phone: true, provider: true, status: true, reference: true },
    });
  });

  console.log(`[WITHDRAW] Created request ${request.id} (ref=${ref}) for driver ${driver.id}, amount=${amountMwk} MWK, provider=${provider}`);
  await enqueueWithdrawal(request.id);
  console.log(`[WITHDRAW] Queued request ${request.id} for processing`);

  return {
    id: request.id,
    amountMwk: request.amountMwk.toString(),
    reference: request.reference,
    status: request.status,
    phone: request.phone,
    provider: request.provider,
    message: "Withdrawal queued",
  };
}

export async function processWithdrawalRequest(withdrawalId: string) {
  console.log(`[WITHDRAW] Worker picked up request ${withdrawalId}`);

  // Step 1 — Atomically debit wallet and mark as processing
  const request = await prisma.$transaction(async (client) => {
    const req = await client.walletWithdrawalRequest.findUnique({
      where: { id: withdrawalId },
      select: {
        id: true,
        driverId: true,
        amountMwk: true,
        phone: true,
        provider: true,
        status: true,
        reference: true,
        walletTxId: true,
      },
    });
    if (!req) {
      console.warn(`[WITHDRAW] Request ${withdrawalId} not found`);
      throw new AppError(404, "Withdrawal request not found");
    }
    if (req.status === "completed") {
      console.log(`[WITHDRAW] Request ${withdrawalId} already completed — skipping`);
      return req;
    }
    if (req.status === "processing") {
      console.log(`[WITHDRAW] Request ${withdrawalId} already processing — skipping`);
      return req; // already being processed
    }
    if (req.status === "failed") {
      console.warn(`[WITHDRAW] Request ${withdrawalId} already failed — skipping silently`);
      return null; // return null to exit cleanly (not throw — BullMQ would retry)
    }

    // Calculate fee
    const { feeMwk, netAmountMwk } = calculateWithdrawalFee(req.amountMwk, req.provider);
    console.log(`[WITHDRAW] Request ${withdrawalId} — fee calculation: gross=${req.amountMwk}, fee=${feeMwk}, net=${netAmountMwk}, provider=${req.provider}`);

    if (netAmountMwk <= 0n) {
      console.warn(`[WITHDRAW] Request ${withdrawalId} — net amount is zero/negative after fees, failing`);
      await client.walletWithdrawalRequest.update({
        where: { id: req.id },
        data: {
          status: "failed",
          failureReason: "Withdrawal amount too small after fees",
          processedAt: new Date(),
        },
      });
      throw new AppError(400, "Withdrawal amount is too small after deducting fees");
    }

    // Verify sufficient balance for gross amount
    const wallet = await client.driverWallet.findUnique({
      where: { driverId: req.driverId },
      select: { balanceMwk: true },
    });
    if (!wallet || wallet.balanceMwk < req.amountMwk) {
      console.warn(`[WITHDRAW] Request ${withdrawalId} — insufficient balance: need=${req.amountMwk}, have=${wallet?.balanceMwk ?? 'N/A'}`);
      throw new AppError(400, "Insufficient balance");
    }

    await client.walletWithdrawalRequest.update({
      where: { id: req.id },
      data: { status: "processing" },
    });
    console.log(`[WITHDRAW] Request ${withdrawalId} — status set to processing (wallet NOT debited until webhook confirms)`);

    // Enqueue timeout: if no webhook within N minutes, auto-fail
    const timeoutMs = env.WITHDRAWAL_PROCESSING_TIMEOUT_MINUTES * 60 * 1000;
    await enqueueWithdrawalTimeout(req.id, timeoutMs);
    console.log(`[WITHDRAW] Request ${withdrawalId} — timeout scheduled in ${env.WITHDRAWAL_PROCESSING_TIMEOUT_MINUTES} minutes`);

    return { ...req, feeMwk, netAmountMwk };
  });

  // Exit cleanly if already in terminal state
  if (!request) {
    console.log(`[WITHDRAW] Request ${withdrawalId} skipped — already in terminal state`);
    return { id: withdrawalId, status: "failed", skipped: true };
  }

  // Step 2 — Call Paychangu payout API (outside transaction)
  const chargeId = `PAYOUT-${request.id}`;
  console.log(`[WITHDRAW] Request ${withdrawalId} — initiating Paychangu payout, chargeId=${chargeId}, netAmount=${(request as { netAmountMwk: bigint }).netAmountMwk}`);
  try {
    const payout = await initiatePaychanguWithdrawalPayout({
      amountMwk: request.amountMwk,
      netAmountMwk: (request as { netAmountMwk: bigint }).netAmountMwk,
      phone: request.phone,
      provider: request.provider,
      chargeId,
    });

    if (!payout.success) {
      console.warn(`[WITHDRAW] Request ${withdrawalId} — Paychangu rejected the payout, refunding wallet`);
      await refundWithdrawal(withdrawalId);
      return prisma.walletWithdrawalRequest.findUnique({ where: { id: withdrawalId } });
    }

    console.log(`[WITHDRAW] Request ${withdrawalId} — Paychangu payout accepted, awaiting webhook confirmation`);
    // Step 3 — Store gateway response; status stays "processing" until webhook confirms
    return prisma.walletWithdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        reference: `${request.reference}|chargeId:${chargeId}`,
      },
      select: {
        id: true,
        amountMwk: true,
        provider: true,
        status: true,
        reference: true,
      },
    });
  } catch (error) {
    console.error(`[WITHDRAW] Request ${withdrawalId} — Paychangu payout call failed:`, (error as Error).message);
    await refundWithdrawal(withdrawalId);
    throw error;
  }
}

/**
 * Refunds a withdrawal: credits the wallet back and marks the request as failed.
 * Idempotent — skips if already completed/failed.
 */
export async function refundWithdrawal(withdrawalId: string) {
  console.log(`[WITHDRAW] Refunding withdrawal ${withdrawalId}`);
  return prisma.$transaction(async (client) => {
    const req = await client.walletWithdrawalRequest.findUnique({
      where: { id: withdrawalId },
      select: { id: true, driverId: true, amountMwk: true, status: true, reference: true },
    });
    if (!req || req.status === "completed" || req.status === "failed") {
      console.log(`[WITHDRAW] Refund skipped for ${withdrawalId} — status=${req?.status ?? 'not-found'}`);
      return req;
    }

    // Credit the wallet back
    const tx = await createWalletLedgerEntry(client, {
      driverId: req.driverId,
      type: "credit",
      kind: "admin_adjustment_credit",
      amountMwk: req.amountMwk,
      reference: `refund:${req.reference}`,
      metadata: { withdrawalId: req.id, reason: "withdrawal_payout_failed" },
      countAsEarnings: false,
    });
    console.log(`[WITHDRAW] Refund ${withdrawalId} — wallet credited back ${req.amountMwk} MWK, txId=${tx.id}`);

    return client.walletWithdrawalRequest.update({
      where: { id: req.id },
      data: {
        status: "failed",
        failureReason: "Paychangu payout was not completed",
        processedAt: new Date(),
      },
    });
  });
}

/**
 * Finalizes a withdrawal after Paychangu webhook confirms the payout.
 * Updates status from "processing" to "completed".
 * Idempotent — only transitions from "processing" to "completed".
 */
export async function finalizeWithdrawalPayout(withdrawalId: string, success: boolean, message?: string) {
  console.log(`[WITHDRAW] Webhook finalization for ${withdrawalId} — success=${success}${message ? `, message=${message}` : ""}`);
  const req = await prisma.walletWithdrawalRequest.findUnique({
    where: { id: withdrawalId },
    select: { id: true, status: true },
  });
  if (!req) {
    console.warn(`[WITHDRAW] Webhook for unknown withdrawal: ${withdrawalId}`);
    return null;
  }
  if (req.status === "completed") {
    console.log(`[WITHDRAW] Withdrawal ${withdrawalId} already completed — skipping webhook`);
    return req;
  }
  if (req.status === "failed") {
    console.log(`[WITHDRAW] Withdrawal ${withdrawalId} already failed — skipping webhook`);
    return req;
  }

  if (success) {
    console.log(`[WITHDRAW] Withdrawal ${withdrawalId} — webhook confirmed success, debiting wallet and marking completed`);
    // Debit the wallet now that payout is confirmed
    const req = await prisma.walletWithdrawalRequest.findUnique({
      where: { id: withdrawalId },
      select: { id: true, driverId: true, amountMwk: true, phone: true, provider: true, reference: true },
    });
    if (!req) return null;

    return prisma.$transaction(async (client) => {
      const tx = await createWalletLedgerEntry(client, {
        driverId: req.driverId,
        type: "withdrawal",
        kind: "withdrawal_debit",
        amountMwk: req.amountMwk,
        reference: req.reference,
        metadata: { phone: req.phone, provider: req.provider, withdrawalId: req.id, webhookConfirmed: true },
        countAsEarnings: false,
      });
      console.log(`[WITHDRAW] Withdrawal ${withdrawalId} — wallet debited ${req.amountMwk} MWK, txId=${tx.id}`);

      return client.walletWithdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: "completed", walletTxId: tx.id, processedAt: new Date() },
        select: { id: true, amountMwk: true, provider: true, status: true },
      });
    });
  }

  // Payout failed per webhook — wallet was never debited, just mark failed
  console.warn(`[WITHDRAW] Withdrawal ${withdrawalId} — webhook reported failure (wallet was not debited), marking failed`);
  return prisma.walletWithdrawalRequest.update({
    where: { id: withdrawalId },
    data: {
      status: "failed",
      failureReason: message ?? "Paychangu payout failed",
      processedAt: new Date(),
    },
    select: { id: true, amountMwk: true, provider: true, status: true, failureReason: true },
  });
}

/**
 * Processes a Paychangu payout webhook payload.
 * Extracts withdrawalId from charge_id (format: PAYOUT-{withdrawalId}).
 */
export async function handlePaychanguPayoutWebhook(payload: Record<string, unknown>) {
  const eventType = String(payload.event_type ?? payload.event ?? "");
  console.log(`[WITHDRAW] Webhook received — event_type=${eventType}`);

  if (eventType !== "api.payout" && eventType !== "payout") {
    console.log(`[WITHDRAW] Webhook ignored — not a payout event (event_type=${eventType})`);
    return { handled: false, reason: "Not a payout event" };
  }

  const chargeId = String(payload.charge_id ?? "");
  if (!chargeId.startsWith("PAYOUT-")) {
    console.warn(`[WITHDRAW] Webhook has invalid charge_id: ${chargeId}`);
    return { handled: false, reason: "charge_id does not match PAYOUT- prefix" };
  }

  const withdrawalId = chargeId.replace("PAYOUT-", "");
  const rawStatus = String(payload.status ?? "");
  const status = rawStatus.toLowerCase();
  const isSuccess = status === "success" || status === "successful";
  const message = String(payload.message ?? "");
  console.log(`[WITHDRAW] Webhook parsed — withdrawalId=${withdrawalId}, status=${rawStatus}, isSuccess=${isSuccess}`);

  const result = await finalizeWithdrawalPayout(withdrawalId, isSuccess, message || undefined);
  return { handled: true, withdrawalId, status: result?.status };
}

/**
 * Called by the timeout worker when a withdrawal has been "processing" for too long
 * without receiving a webhook confirmation. Marks it as failed.
 * Idempotent — only acts on "processing" status.
 */
export async function handleWithdrawalTimeout(withdrawalId: string) {
  console.log(`[WITHDRAW] Timeout triggered for ${withdrawalId}`);
  const req = await prisma.walletWithdrawalRequest.findUnique({
    where: { id: withdrawalId },
    select: { id: true, status: true },
  });
  if (!req) {
    console.warn(`[WITHDRAW] Timeout for unknown withdrawal: ${withdrawalId}`);
    return { id: withdrawalId, handled: false, reason: "not-found" };
  }
  if (req.status === "completed" || req.status === "failed") {
    console.log(`[WITHDRAW] Timeout skipped for ${withdrawalId} — already ${req.status}`);
    return { id: withdrawalId, handled: false, reason: `already-${req.status}` };
  }
  if (req.status !== "processing") {
    console.log(`[WITHDRAW] Timeout skipped for ${withdrawalId} — status=${req.status}`);
    return { id: withdrawalId, handled: false, reason: `unexpected-status-${req.status}` };
  }

  console.warn(`[WITHDRAW] Withdrawal ${withdrawalId} timed out after ${env.WITHDRAWAL_PROCESSING_TIMEOUT_MINUTES} minutes — marking failed`);
  const updated = await prisma.walletWithdrawalRequest.update({
    where: { id: withdrawalId },
    data: {
      status: "failed",
      failureReason: `No webhook confirmation received within ${env.WITHDRAWAL_PROCESSING_TIMEOUT_MINUTES} minutes`,
      processedAt: new Date(),
    },
    select: { id: true, status: true, failureReason: true },
  });
  return { handled: true, ...updated };
}

export async function creditTripPayout(
  client: Prisma.TransactionClient,
  input: { driverId: string; bookingId: string; paymentId: string; amountMwk: bigint; reference?: string | null },
) {
  const existing = await client.walletTransaction.findFirst({
    where: { paymentId: input.paymentId, kind: "trip_payout_credit" },
    select: { id: true },
  });
  if (existing) return existing;

  return createWalletLedgerEntry(client, {
    driverId: input.driverId,
    type: "credit",
    kind: "trip_payout_credit",
    amountMwk: input.amountMwk,
    bookingId: input.bookingId,
    paymentId: input.paymentId,
    reference: input.reference ?? null,
  });
}

export async function creditRefundConvenienceShare(
  client: Prisma.TransactionClient,
  input: {
    driverId: string;
    bookingId: string;
    paymentId: string;
    refundId: string;
    amountMwk: bigint;
    reference?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const existing = await client.walletTransaction.findFirst({
    where: { refundId: input.refundId, kind: "refund_convenience_credit" },
    select: { id: true },
  });
  if (existing) return existing;

  return createWalletLedgerEntry(client, {
    driverId: input.driverId,
    type: "credit",
    kind: "refund_convenience_credit",
    amountMwk: input.amountMwk,
    bookingId: input.bookingId,
    paymentId: input.paymentId,
    refundId: input.refundId,
    reference: input.reference ?? null,
    metadata: input.metadata,
  });
}
