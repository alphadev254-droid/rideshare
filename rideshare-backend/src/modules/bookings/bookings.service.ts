import { BookingPaymentStatus, BookingStatus, PaymentMethod, Prisma, RefundStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/error-handler.js";
import { generateCode, storeCode, hashCode, isCodeExpired } from "../../lib/secret-code.js";
import { sendSecretCode } from "../../lib/sms.js";
import {
  extractPaychanguMobilePaymentDetails,
  fetchPaychanguPayoutDetails,
  initiatePaychanguMobileMoneyRefund,
} from "../../lib/paychangu.js";
import { enqueueRefundTimeout } from "../../jobs/queue.js";
import { creditRefundConvenienceShare } from "../wallet/wallet.service.js";
import type { CreateBookingInput } from "./bookings.schemas.js";

const bookingDetailSelect = {
  id: true,
  tripId: true,
  segmentId: true,
  passengerId: true,
  seatsBooked: true,
  travelers: { orderBy: { seatOrder: "asc" }, select: { id: true, fullName: true, phone: true, seatOrder: true, isPrimary: true } },
  boardingPoint: true,
  dropOffPoint: true,
  rawSecretCode: true,
  codeUsed: true,
  codeExpiresAt: true,
  status: true,
  paymentStatus: true,
  fareMwk: true,
  ratedDriver: true,
  createdAt: true,
  passenger: { select: { id: true, fullName: true, phone: true, email: true, rating: true } },
  segment: {
    select: {
      id: true,
      fareMwk: true,
      fromOrder: true,
      toOrder: true,
      fromStop: { select: { name: true, pickupPoint: true, departureOffsetMinutes: true } },
      toStop: { select: { name: true, dropOffPoint: true, arrivalOffsetMinutes: true } },
    },
  },
  trip: {
    select: {
      id: true,
      originName: true,
      destinationName: true,
      departureTime: true,
      baseFareMwk: true,
      status: true,
      startedAt: true,
      driver: {
        select: {
          id: true,
          userId: true,
          user: { select: { id: true, fullName: true, phone: true, email: true } },
        },
      },
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          plateNumber: true,
          color: true,
          comfortClass: true,
          images: { select: { url: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  },
  payment: {
    select: {
      id: true,
      status: true,
      gatewayRef: true,
      customerAmountMwk: true,
      netAmountMwk: true,
      createdAt: true,
      refunds: {
        where: { status: { in: ["requested", "processing", "completed"] } },
        select: { id: true, status: true, requestedAt: true, processedAt: true },
        take: 1,
      },
    },
  },
} satisfies Prisma.BookingSelect;

function amountFromRate(amount: bigint, rate: number) {
  if (rate <= 0) return 0n;
  return BigInt(Math.round(Number(amount) * rate));
}

function clampRate(rate: number, max = 1) {
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return Math.min(rate, max);
}

function calculateRefundAmounts(customerAmountMwk: bigint) {
  const convenienceFeeRate = clampRate(env.REFUND_CONVENIENCE_FEE_RATE);
  const driverShareRate = clampRate(env.DRIVER_REFUND_CONVENIENCE_SHARE_RATE);
  const convenienceFeeMwk = amountFromRate(customerAmountMwk, convenienceFeeRate);
  const safeConvenienceFeeMwk =
    convenienceFeeMwk > customerAmountMwk ? customerAmountMwk : convenienceFeeMwk;
  const driverConvenienceShareMwk = amountFromRate(safeConvenienceFeeMwk, driverShareRate);
  const platformConvenienceFeeMwk = safeConvenienceFeeMwk - driverConvenienceShareMwk;
  const refundAmountMwk = customerAmountMwk - safeConvenienceFeeMwk;

  return {
    refundableBaseMwk: customerAmountMwk,
    convenienceFeeRate,
    convenienceFeeMwk: safeConvenienceFeeMwk,
    driverConvenienceShareRate: driverShareRate,
    driverConvenienceShareMwk,
    platformConvenienceFeeMwk,
    refundAmountMwk,
  };
}

function formatRefund(refund: {
  id: string;
  paymentId: string;
  bookingId: string;
  status: string;
  reason: string | null;
  originalCustomerAmountMwk: bigint;
  refundableBaseMwk: bigint;
  convenienceFeeRate: Prisma.Decimal | number;
  convenienceFeeMwk: bigint;
  driverConvenienceShareRate: Prisma.Decimal | number;
  driverConvenienceShareMwk: bigint;
  platformConvenienceFeeMwk: bigint;
  refundAmountMwk: bigint;
  paymentMethod?: string | null;
  providerChannel?: string | null;
  providerOperatorRefId?: string | null;
  providerOperatorName?: string | null;
  recipientPhone?: string | null;
  gatewayChargeId?: string | null;
  providerReference?: string | null;
  providerTransactionId?: string | null;
  providerStatus?: string | null;
  providerPayload?: Prisma.JsonValue | null;
  gatewayRequestedAt?: Date | null;
  gatewayRespondedAt?: Date | null;
  webhookReceivedAt?: Date | null;
  failedAt?: Date | null;
  failureReason?: string | null;
  requestedAt: Date;
  processedAt: Date | null;
}) {
  return {
    ...refund,
    originalCustomerAmountMwk: refund.originalCustomerAmountMwk.toString(),
    refundableBaseMwk: refund.refundableBaseMwk.toString(),
    convenienceFeeRate: refund.convenienceFeeRate.toString(),
    convenienceFeeMwk: refund.convenienceFeeMwk.toString(),
    driverConvenienceShareRate: refund.driverConvenienceShareRate.toString(),
    driverConvenienceShareMwk: refund.driverConvenienceShareMwk.toString(),
    platformConvenienceFeeMwk: refund.platformConvenienceFeeMwk.toString(),
    refundAmountMwk: refund.refundAmountMwk.toString(),
  };
}

const refundSelect = {
  id: true,
  paymentId: true,
  bookingId: true,
  status: true,
  reason: true,
  originalCustomerAmountMwk: true,
  refundableBaseMwk: true,
  convenienceFeeRate: true,
  convenienceFeeMwk: true,
  driverConvenienceShareRate: true,
  driverConvenienceShareMwk: true,
  platformConvenienceFeeMwk: true,
  refundAmountMwk: true,
  paymentMethod: true,
  providerChannel: true,
  providerOperatorRefId: true,
  providerOperatorName: true,
  recipientPhone: true,
  gatewayChargeId: true,
  providerReference: true,
  providerTransactionId: true,
  providerStatus: true,
  providerPayload: true,
  gatewayRequestedAt: true,
  gatewayRespondedAt: true,
  webhookReceivedAt: true,
  failedAt: true,
  failureReason: true,
  requestedAt: true,
  processedAt: true,
} satisfies Prisma.PaymentRefundSelect;

/** Leaner include for list queries — no payment/transaction data. */
const bookingAdminListSelect = {
  id: true,
  segmentId: true,
  boardingPoint: true,
  dropOffPoint: true,
  seatsBooked: true,
  status: true,
  paymentStatus: true,
  fareMwk: true,
  travelers: { orderBy: { seatOrder: "asc" }, select: { id: true, fullName: true, phone: true, seatOrder: true, isPrimary: true } },
  createdAt: true,
  passenger: { select: { fullName: true, phone: true } },
  segment: {
    select: {
      id: true,
      fromStop: { select: { name: true } },
      toStop: { select: { name: true } },
    },
  },
  trip: {
    select: {
      originName: true,
      destinationName: true,
      driver: {
        select: {
          user: { select: { fullName: true } },
        },
      },
    },
  },
} satisfies Prisma.BookingSelect;

type BookingWithRelations = Prisma.BookingGetPayload<{ select: typeof bookingDetailSelect }>;
type AdminBookingListRow = Prisma.BookingGetPayload<{ select: typeof bookingAdminListSelect }>;

function toMoney(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return "0";
  return typeof value === "bigint" ? value.toString() : String(value);
}

function formatBooking(
  booking: BookingWithRelations,
  options: { showBoardingCode?: boolean } = {},
) {
  const { rawSecretCode: _rawSecretCode, ...safeBooking } = booking;
  return {
    ...safeBooking,
    fareMwk: toMoney(booking.fareMwk),
    codeAvailable: Boolean(booking.rawSecretCode && !booking.codeUsed),
    boardingCode: options.showBoardingCode && !booking.codeUsed ? booking.rawSecretCode : null,
    segment: booking.segment
      ? {
          ...booking.segment,
          fareMwk: toMoney(booking.segment.fareMwk),
        }
      : null,
    passenger: booking.passenger
      ? {
          ...booking.passenger,
          rating: booking.passenger.rating?.toString() ?? null,
        }
      : null,
    trip: booking.trip
      ? {
          ...booking.trip,
          vehicle: booking.trip.vehicle
            ? {
                ...booking.trip.vehicle,
                imageUrls: booking.trip.vehicle.images.map((row) => row.url),
                images: undefined,
              }
            : null,
          baseFareMwk: toMoney(booking.trip.baseFareMwk),
        }
      : null,
    payment: booking.payment
      ? {
          ...booking.payment,
          customerAmountMwk: toMoney(booking.payment.customerAmountMwk),
          netAmountMwk: toMoney(booking.payment.netAmountMwk),
        }
      : null,
  };
}

function formatAdminBookingList(booking: AdminBookingListRow) {
  return {
    id: booking.id,
    boardingPoint: booking.boardingPoint,
    dropOffPoint: booking.dropOffPoint,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    createdAt: booking.createdAt,
    fareMwk: toMoney(booking.fareMwk),
    seatsBooked: booking.seatsBooked,
    travelers: booking.travelers,
    segment: booking.segment,
    passenger: booking.passenger,
    trip: booking.trip
      ? {
          ...booking.trip,
        }
      : null,
  };
}

async function getCaller(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, driverProfile: { select: { id: true } } },
  });
  if (!user) throw new AppError(401, "User not found");
  return user;
}

export async function createBooking(_passengerId: string, _input: CreateBookingInput) {
  throw new AppError(
    400,
    "Bookings are created only after a successful payment. Start payment with /payments/initiate-ride.",
  );
}

export async function getBookingById(bookingId: string, userId: string) {
  const caller = await getCaller(userId);
  const booking = await prisma.booking.findFirst({
    where:
      caller.role === "admin"
        ? { id: bookingId }
        : {
            id: bookingId,
            OR: [
              { passengerId: userId },
              caller.driverProfile?.id ? { trip: { driverId: caller.driverProfile.id } } : undefined,
            ].filter(Boolean) as Prisma.BookingWhereInput[],
          },
    select: bookingDetailSelect,
  });
  if (!booking) throw new AppError(404, "Booking not found");
  return formatBooking(booking, {
    showBoardingCode: caller.role === "admin" || booking.passengerId === userId,
  });
}

export async function resendCode(bookingId: string, passengerId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, passengerId },
    select: bookingDetailSelect,
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.codeUsed) throw new AppError(400, "Code already used");

  const expired = await isCodeExpired(bookingId);
  if (expired) throw new AppError(400, "Code has expired. Please contact support");

  const newRawCode = generateCode();
  const newHash = await hashCode(newRawCode);

  await prisma.booking.update({
    where: { id: bookingId },
    data: { secretCode: newHash },
  });
  await storeCode(bookingId, newRawCode);

  const route = `${booking.trip.originName} -> ${booking.trip.destinationName}`;
  await sendSecretCode(booking.passenger.phone ?? "", newRawCode, booking.trip.driver.user.fullName, route);

  return { message: "Code resent" };
}

export async function cancelBooking(bookingId: string, userId: string) {
  const caller = await getCaller(userId);
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      status: { in: ["pending", "confirmed"] },
      ...(caller.role === "admin" ? {} : { passengerId: userId }),
    },
    include: { trip: { select: { status: true, startedAt: true } } },
  });
  if (!booking) throw new AppError(404, "Booking not found or cannot be cancelled");
  if (caller.role !== "admin") {
    if (booking.codeUsed || booking.status === "authenticated") {
      throw new AppError(400, "This booking has already been boarded and cannot be cancelled");
    }
    if (booking.trip.startedAt || ["in_transit", "completed", "cancelled"].includes(booking.trip.status)) {
      throw new AppError(400, "This trip has already started and cannot be cancelled");
    }
    if (booking.paymentStatus === "held_in_escrow") {
      throw new AppError(400, "Use the refund request flow for paid bookings");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (!booking.segmentId) {
      await tx.trip.update({ where: { id: booking.tripId }, data: { availableSeats: { increment: booking.seatsBooked } } });
    }

    if (booking.paymentStatus === "held_in_escrow") {
      await tx.payment.updateMany({
        where: { bookingId },
        data: { status: "refunded", refundedAt: new Date() },
      });
      await tx.booking.update({ where: { id: bookingId }, data: { paymentStatus: "refunded" } });
    }

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled" },
      select: bookingDetailSelect,
    });
  });

  return formatBooking(updated, {
    showBoardingCode: caller.role === "admin" || updated.passengerId === userId,
  });
}

export async function getRefundPreview(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, passengerId: userId },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      codeUsed: true,
      payment: {
        select: {
          id: true,
          status: true,
          customerAmountMwk: true,
          fareAmountMwk: true,
          providerFeeMwk: true,
        },
      },
      trip: { select: { status: true, startedAt: true, departureTime: true } },
    },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (!booking.payment) throw new AppError(400, "This booking has no completed payment");
  if (booking.paymentStatus !== "held_in_escrow" || booking.payment.status !== "escrow_held") {
    throw new AppError(400, "Only escrow-held bookings can be refunded by the passenger");
  }
  if (booking.codeUsed || booking.status === "authenticated") {
    throw new AppError(400, "This booking has already been boarded and cannot be self-refunded");
  }
  if (booking.trip.startedAt || ["in_transit", "completed", "cancelled"].includes(booking.trip.status)) {
    throw new AppError(400, "This trip has already started and cannot be self-refunded");
  }

  const amounts = calculateRefundAmounts(booking.payment.customerAmountMwk);
  return {
    bookingId: booking.id,
    paymentId: booking.payment.id,
    fareAmountMwk: booking.payment.fareAmountMwk.toString(),
    providerFeeMwk: booking.payment.providerFeeMwk.toString(),
    originalCustomerAmountMwk: booking.payment.customerAmountMwk.toString(),
    refundableBaseMwk: amounts.refundableBaseMwk.toString(),
    convenienceFeeRate: amounts.convenienceFeeRate.toString(),
    convenienceFeeMwk: amounts.convenienceFeeMwk.toString(),
    driverConvenienceShareRate: amounts.driverConvenienceShareRate.toString(),
    driverConvenienceShareMwk: amounts.driverConvenienceShareMwk.toString(),
    platformConvenienceFeeMwk: amounts.platformConvenienceFeeMwk.toString(),
    refundAmountMwk: amounts.refundAmountMwk.toString(),
    policy:
      "A convenience fee is deducted from the amount paid. The remaining amount is marked for refund, and the driver receives their configured share of the convenience fee.",
  };
}

export async function requestBookingRefund(bookingId: string, userId: string, reason?: string) {
  const pendingRefund = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: bookingId, passengerId: userId },
      select: {
        id: true,
        tripId: true,
        segmentId: true,
        seatsBooked: true,
        status: true,
        paymentStatus: true,
        codeUsed: true,
        trip: { select: { status: true, startedAt: true } },
        payment: {
          select: {
            id: true,
            status: true,
            bookingId: true,
            passengerId: true,
            driverId: true,
            customerAmountMwk: true,
            paymentMethod: true,
            providerReference: true,
            providerChannel: true,
            providerOperatorRefId: true,
            providerOperatorName: true,
            providerMobileNumber: true,
            providerPayload: true,
            passenger: { select: { phone: true } },
            refunds: {
              where: { status: { in: ["requested", "processing", "completed"] } },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!booking) throw new AppError(404, "Booking not found");
    if (!booking.payment) throw new AppError(400, "This booking has no completed payment");
    if (booking.payment.refunds.length > 0) throw new AppError(400, "A refund already exists for this booking");
    if (booking.paymentStatus !== "held_in_escrow" || booking.payment.status !== "escrow_held") {
      throw new AppError(400, "Only escrow-held bookings can be refunded by the passenger");
    }
    if (booking.codeUsed || booking.status === "authenticated") {
      throw new AppError(400, "This booking has already been boarded and cannot be self-refunded");
    }
    if (booking.trip.startedAt || ["in_transit", "completed", "cancelled"].includes(booking.trip.status)) {
      throw new AppError(400, "This trip has already started and cannot be self-refunded");
    }

    const amounts = calculateRefundAmounts(booking.payment.customerAmountMwk);
    const payloadPayment = extractPaychanguMobilePaymentDetails(booking.payment.providerPayload);
    const paidPhone = booking.payment.providerMobileNumber ?? payloadPayment.mobileNumber;
    if (!paidPhone) {
      throw new AppError(
        400,
        "Cannot automatically refund because the original PayChangu payment phone was not saved. Use manual review for this payment.",
      );
    }
    const operatorRefId = booking.payment.providerOperatorRefId ?? payloadPayment.operatorRefId;
    const operatorName = booking.payment.providerOperatorName ?? payloadPayment.operatorName;
    const providerChannel = booking.payment.providerChannel ?? payloadPayment.channel;
    const refundId = randomUUID();
    const chargeId = `RF-${refundId}`;
    const created = await tx.paymentRefund.create({
      data: {
        id: refundId,
        paymentId: booking.payment.id,
        bookingId: booking.id,
        passengerId: booking.payment.passengerId,
        driverId: booking.payment.driverId,
        status: "processing",
        reason: reason?.trim() || null,
        originalCustomerAmountMwk: booking.payment.customerAmountMwk,
        refundableBaseMwk: amounts.refundableBaseMwk,
        convenienceFeeRate: amounts.convenienceFeeRate,
        convenienceFeeMwk: amounts.convenienceFeeMwk,
        driverConvenienceShareRate: amounts.driverConvenienceShareRate,
        driverConvenienceShareMwk: amounts.driverConvenienceShareMwk,
        platformConvenienceFeeMwk: amounts.platformConvenienceFeeMwk,
        refundAmountMwk: amounts.refundAmountMwk,
        paymentMethod: booking.payment.paymentMethod,
        providerChannel,
        providerOperatorRefId: operatorRefId,
        providerOperatorName: operatorName,
        recipientPhone: paidPhone,
        gatewayChargeId: chargeId,
        providerReference: booking.payment.providerReference,
        gatewayRequestedAt: new Date(),
      },
      select: {
        id: true,
        paymentId: true,
        bookingId: true,
        status: true,
        reason: true,
        originalCustomerAmountMwk: true,
        refundableBaseMwk: true,
        convenienceFeeRate: true,
        convenienceFeeMwk: true,
        driverConvenienceShareRate: true,
        driverConvenienceShareMwk: true,
        platformConvenienceFeeMwk: true,
        refundAmountMwk: true,
        paymentMethod: true,
        providerChannel: true,
        providerOperatorRefId: true,
        providerOperatorName: true,
        recipientPhone: true,
        gatewayChargeId: true,
        providerReference: true,
        providerTransactionId: true,
        providerStatus: true,
        providerPayload: true,
        gatewayRequestedAt: true,
        gatewayRespondedAt: true,
        webhookReceivedAt: true,
        failedAt: true,
        failureReason: true,
        requestedAt: true,
        processedAt: true,
      },
    });

    return {
      refund: created,
      tripId: booking.tripId,
      segmentId: booking.segmentId,
      driverId: booking.payment.driverId,
      passengerPhone: paidPhone,
      paymentMethod: booking.payment.paymentMethod,
      providerOperatorRefId: operatorRefId,
      providerOperatorName: operatorName,
      seatsBooked: booking.seatsBooked,
      chargeId,
    };
  });

  let payout;
  try {
    payout = await initiatePaychanguMobileMoneyRefund({
      paymentMethod: pendingRefund.paymentMethod,
      operatorRefId: pendingRefund.providerOperatorRefId,
      operatorName: pendingRefund.providerOperatorName,
      passengerPhone: pendingRefund.passengerPhone,
      amountMwk: pendingRefund.refund.refundAmountMwk,
      chargeId: pendingRefund.chargeId,
    });
  } catch (error) {
    await prisma.paymentRefund.update({
      where: { id: pendingRefund.refund.id },
      data: {
        status: "failed",
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : "PayChangu refund payout failed",
      },
    });
    throw error;
  }

  const refund = await prisma.paymentRefund.update({
    where: { id: pendingRefund.refund.id },
    data: {
      providerStatus:
        payout.providerStatus ?? (payout.uncertain ? "request_uncertain" : "pending"),
      providerReference: payout.providerReference ?? undefined,
      providerTransactionId: payout.providerTransactionId ?? undefined,
      providerPayload: payout.providerPayload,
      gatewayRespondedAt: payout.uncertain ? null : new Date(),
      failureReason: payout.uncertain
        ? "PayChangu refund payout response timed out locally; awaiting webhook or reconciliation"
        : null,
    },
    select: refundSelect,
  });
  await enqueueRefundTimeout(
    pendingRefund.refund.id,
    env.WITHDRAWAL_PROCESSING_TIMEOUT_MINUTES * 60_000,
  );

  return formatRefund(refund);
}

export async function finalizeRefundPayout(
  refundId: string,
  success: boolean,
  message?: string,
  gateway?: {
    providerStatus?: string | null;
    providerReference?: string | null;
    providerTransactionId?: string | null;
    providerPayload?: Prisma.InputJsonValue;
    webhookReceivedAt?: Date | null;
  },
) {
  const refund = await prisma.paymentRefund.findUnique({
    where: { id: refundId },
    include: {
      booking: { select: { id: true, tripId: true, segmentId: true, seatsBooked: true } },
    },
  });
  if (!refund) {
    console.warn(`[REFUND] Payout finalization for unknown refund: ${refundId}`);
    return null;
  }
  if (refund.status === "completed") return formatRefund(refund);
  if (refund.status === "failed" && !success) return formatRefund(refund);

  if (!success) {
    const failed = await prisma.paymentRefund.update({
      where: { id: refundId },
      data: {
        status: "failed",
        failedAt: new Date(),
        processedAt: new Date(),
        webhookReceivedAt: gateway?.webhookReceivedAt ?? new Date(),
        failureReason: message ?? "PayChangu refund payout failed",
        providerStatus: gateway?.providerStatus ?? "failed",
        providerReference: gateway?.providerReference ?? undefined,
        providerTransactionId: gateway?.providerTransactionId ?? undefined,
        providerPayload: gateway?.providerPayload ?? undefined,
      },
      select: refundSelect,
    });
    return formatRefund(failed);
  }

  const completed = await prisma.$transaction(async (tx) => {
    const current = await tx.paymentRefund.findUnique({
      where: { id: refundId },
      include: {
        booking: { select: { id: true, tripId: true, segmentId: true, seatsBooked: true } },
      },
    });
    if (!current) throw new AppError(404, "Refund not found");
    if (current.status === "completed") return current;

    const updated = await tx.paymentRefund.update({
      where: { id: refundId },
      data: {
        status: "completed",
        processedAt: new Date(),
        webhookReceivedAt: gateway?.webhookReceivedAt ?? new Date(),
        failureReason: null,
        providerStatus: gateway?.providerStatus ?? "success",
        providerReference: gateway?.providerReference ?? undefined,
        providerTransactionId: gateway?.providerTransactionId ?? undefined,
        providerPayload: gateway?.providerPayload ?? undefined,
      },
      select: refundSelect,
    });

    await tx.payment.update({
      where: { id: current.paymentId },
      data: { status: "refunded", refundedAt: new Date() },
    });
    await tx.booking.update({
      where: { id: current.bookingId },
      data: { status: "cancelled", paymentStatus: "refunded", rawSecretCode: null },
    });
    if (!current.booking.segmentId) {
      await tx.trip.update({
        where: { id: current.booking.tripId },
        data: { availableSeats: { increment: current.booking.seatsBooked } },
      });
    }

    if (current.driverConvenienceShareMwk > 0n) {
      await creditRefundConvenienceShare(tx, {
        driverId: current.driverId,
        bookingId: current.bookingId,
        paymentId: current.paymentId,
        refundId: current.id,
        amountMwk: current.driverConvenienceShareMwk,
        reference: `REFUND-${current.id}`,
        metadata: {
          convenienceFeeRate: current.convenienceFeeRate.toString(),
          driverConvenienceShareRate: current.driverConvenienceShareRate.toString(),
          refundAmountMwk: current.refundAmountMwk.toString(),
        },
      });
    }

    return updated;
  });

  return formatRefund(completed);
}

export async function handlePaychanguRefundPayoutWebhook(
  payload: Record<string, unknown>,
) {
  console.log("[REFUND] Raw payout webhook payload:", JSON.stringify(payload, null, 2));
  const normalized = normalizeRefundPayoutPayload(payload);
  const chargeId = String(normalized.chargeId ?? "");
  if (!chargeId.startsWith("RF-")) {
    return { handled: false, reason: "charge_id does not match RF- prefix" };
  }

  const refund = await prisma.paymentRefund.findFirst({
    where: { gatewayChargeId: chargeId },
    select: { id: true },
  });
  if (!refund) return { handled: false, reason: "refund not found", chargeId };

  const rawStatus = String(normalized.providerStatus ?? "");
  const status = rawStatus.toLowerCase();
  const isSuccess = status === "success" || status === "successful";
  const isPending = status === "pending" || status === "processing";
  const providerPayload = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;

  if (isPending) {
    await prisma.paymentRefund.update({
      where: { id: refund.id },
      data: {
        providerStatus: normalized.providerStatus ?? "pending",
        providerReference: normalized.providerReference ?? undefined,
        providerTransactionId: normalized.providerTransactionId ?? undefined,
        providerPayload,
        webhookReceivedAt: new Date(),
        failureReason: null,
      },
    });
    return { handled: true, refundId: refund.id, status: "processing" };
  }

  const finalized = await finalizeRefundPayout(
    refund.id,
    isSuccess,
    normalized.message ?? undefined,
    {
      providerStatus: normalized.providerStatus,
      providerReference: normalized.providerReference,
      providerTransactionId: normalized.providerTransactionId,
      providerPayload,
      webhookReceivedAt: new Date(),
    },
  );
  return { handled: true, refundId: refund.id, status: finalized?.status };
}

export async function handleRefundPayoutTimeout(refundId: string) {
  const refund = await prisma.paymentRefund.findUnique({
    where: { id: refundId },
    select: { id: true, status: true, gatewayChargeId: true },
  });
  if (!refund || refund.status !== "processing") {
    return { handled: false, id: refundId, reason: refund ? `already-${refund.status}` : "not-found" };
  }

  if (refund.gatewayChargeId) {
    try {
      const details = await fetchPaychanguPayoutDetails(refund.gatewayChargeId);
      const status = String(details.providerStatus ?? "").toLowerCase();
      const gateway = {
        providerStatus: details.providerStatus,
        providerReference: details.providerReference,
        providerTransactionId: details.providerTransactionId,
        providerPayload: details.providerPayload,
      };

      if (status === "success" || status === "successful") {
        return finalizeRefundPayout(refundId, true, undefined, gateway);
      }

      await prisma.paymentRefund.update({
        where: { id: refundId },
        data: {
          providerStatus: details.providerStatus ?? undefined,
          providerReference: details.providerReference ?? undefined,
          providerTransactionId: details.providerTransactionId ?? undefined,
          providerPayload: details.providerPayload,
        },
      });

      if (status === "pending" || status === "processing") {
        return { handled: false, id: refundId, reason: `paychangu-${status}` };
      }
      if (status === "failed" || status === "failure" || status === "rejected") {
        return finalizeRefundPayout(
          refundId,
          false,
          "PayChangu refund payout failed",
          gateway,
        );
      }
    } catch (error) {
      console.warn(`[REFUND] Timeout reconciliation failed for ${refundId}:`, (error as Error).message);
    }
  }

  return finalizeRefundPayout(
    refundId,
    false,
    `No webhook confirmation received within ${env.WITHDRAWAL_PROCESSING_TIMEOUT_MINUTES} minutes`,
    { providerStatus: "timeout_waiting_for_webhook" },
  );
}

export async function reconcileRefundForAdmin(refundId: string) {
  return handleRefundPayoutTimeout(refundId);
}

export async function listRefundsForAdmin(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  method?: string;
  needsReconcile?: boolean;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(200, Math.max(1, params.limit ?? 50));
  const where: Prisma.PaymentRefundWhereInput = {};

  if (params.status && params.status !== "all") {
    if (!Object.values(RefundStatus).includes(params.status as RefundStatus)) {
      throw new AppError(400, "Invalid refund status");
    }
    where.status = params.status as RefundStatus;
  }
  if (params.method && params.method !== "all") {
    if (!Object.values(PaymentMethod).includes(params.method as PaymentMethod)) {
      throw new AppError(400, "Invalid refund payment method");
    }
    where.paymentMethod = params.method as PaymentMethod;
  }
  if (params.needsReconcile) {
    where.status = "processing";
    where.gatewayChargeId = { not: null };
  }
  if (params.search?.trim()) {
    const search = params.search.trim();
    where.OR = [
      { gatewayChargeId: { contains: search, mode: "insensitive" } },
      { providerReference: { contains: search, mode: "insensitive" } },
      { providerTransactionId: { contains: search, mode: "insensitive" } },
      { recipientPhone: { contains: search, mode: "insensitive" } },
      { passenger: { fullName: { contains: search, mode: "insensitive" } } },
      { passenger: { phone: { contains: search, mode: "insensitive" } } },
      { driver: { user: { fullName: { contains: search, mode: "insensitive" } } } },
    ];
  }

  const [total, rows] = await prisma.$transaction([
    prisma.paymentRefund.count({ where }),
    prisma.paymentRefund.findMany({
      where,
      include: {
        passenger: { select: { fullName: true, phone: true, email: true } },
        driver: { select: { id: true, user: { select: { fullName: true, phone: true, email: true } } } },
        booking: {
          select: {
            id: true,
            boardingPoint: true,
            dropOffPoint: true,
            trip: { select: { originName: true, destinationName: true } },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map((refund) => ({
      ...formatRefund(refund),
      passengerName: refund.passenger.fullName,
      passengerPhone: refund.passenger.phone,
      passengerEmail: refund.passenger.email,
      driverId: refund.driver.id,
      driverName: refund.driver.user.fullName,
      driverPhone: refund.driver.user.phone,
      driverEmail: refund.driver.user.email,
      route:
        refund.booking.boardingPoint && refund.booking.dropOffPoint
          ? `${refund.booking.boardingPoint} -> ${refund.booking.dropOffPoint}`
          : `${refund.booking.trip.originName} -> ${refund.booking.trip.destinationName}`,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

function normalizeRefundPayoutPayload(payload: Record<string, unknown>) {
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};
  const transaction =
    data.transaction && typeof data.transaction === "object"
      ? (data.transaction as Record<string, unknown>)
      : data;

  return {
    chargeId: stringOrNull(transaction.charge_id ?? data.charge_id ?? payload.charge_id),
    providerStatus: stringOrNull(transaction.status ?? data.status ?? payload.status),
    providerReference: stringOrNull(transaction.ref_id ?? data.ref_id ?? payload.ref_id),
    providerTransactionId: stringOrNull(transaction.trans_id ?? data.trans_id ?? payload.trans_id),
    message: stringOrNull(payload.message ?? data.message),
  };
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

export async function getMyBookings(passengerId: string, page = 1, limit = 20) {
  const bookings = await prisma.booking.findMany({
    where: { passengerId },
    select: bookingDetailSelect,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
  return bookings.map((booking) => formatBooking(booking, { showBoardingCode: true }));
}

export async function getTripBookings(tripId: string, userId: string) {
  const caller = await getCaller(userId);
  const trip = await prisma.trip.findFirst({
    where:
      caller.role === "admin"
        ? { id: tripId }
        : { id: tripId, driver: { userId } },
    select: { id: true },
  });
  if (!trip) throw new AppError(403, "Trip not found or unauthorized");

  const bookings = await prisma.booking.findMany({
    where: { tripId },
    select: bookingDetailSelect,
    orderBy: { createdAt: "asc" },
  });
  return bookings.map((booking) => formatBooking(booking));
}

export async function listAdminBookings(params: {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  search?: string;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 70));
  const where: Prisma.BookingWhereInput = {};

  if (params.status && params.status !== "all") {
    if (!Object.values(BookingStatus).includes(params.status as BookingStatus)) {
      throw new AppError(400, "Invalid booking status");
    }
    where.status = params.status as BookingStatus;
  }

  if (params.paymentStatus && params.paymentStatus !== "all") {
    if (!Object.values(BookingPaymentStatus).includes(params.paymentStatus as BookingPaymentStatus)) {
      throw new AppError(400, "Invalid payment status");
    }
    where.paymentStatus = params.paymentStatus as BookingPaymentStatus;
  }

  if (params.search?.trim()) {
    const search = params.search.trim();
    where.OR = [
      { passenger: { fullName: { contains: search, mode: "insensitive" } } },
      { passenger: { phone: { contains: search, mode: "insensitive" } } },
      { passenger: { email: { contains: search, mode: "insensitive" } } },
      { trip: { originName: { contains: search, mode: "insensitive" } } },
      { trip: { destinationName: { contains: search, mode: "insensitive" } } },
      { trip: { driver: { user: { fullName: { contains: search, mode: "insensitive" } } } } },
      { trip: { driver: { user: { phone: { contains: search, mode: "insensitive" } } } } },
      { trip: { driver: { user: { email: { contains: search, mode: "insensitive" } } } } },
    ];
  }

  const [total, bookings] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      select: bookingAdminListSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data: bookings.map((booking) => formatAdminBookingList(booking)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function verifyBoardingCode(bookingId: string, driverUserId: string, code: string) {
  const { verifyCode: verifyCodeFn, isCodeExpired: isExpired } = await import("../../lib/secret-code.js");

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      trip: { driver: { userId: driverUserId } },
    },
    select: { id: true, secretCode: true, codeUsed: true, status: true, paymentStatus: true, seatsBooked: true, travelers: { orderBy: { seatOrder: "asc" }, select: { id: true, fullName: true, phone: true, seatOrder: true, isPrimary: true } } },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.paymentStatus !== "held_in_escrow" && booking.paymentStatus !== "released") {
    throw new AppError(400, "Passenger payment has not been confirmed");
  }
  if (booking.status !== "confirmed" && booking.status !== "authenticated") {
    throw new AppError(400, "Booking is not ready for boarding verification");
  }
  if (booking.codeUsed) throw new AppError(400, "Code already used");

  const expired = await isExpired(bookingId);
  if (expired) throw new AppError(400, "Code expired");

  const valid = await verifyCodeFn(code, booking.secretCode);
  if (!valid) throw new AppError(400, "Invalid code");

  await prisma.booking.update({
    where: { id: bookingId },
    data: { codeUsed: true, rawSecretCode: null, status: "authenticated" },
  });

  return { verified: true, bookingId, seatsBooked: booking.seatsBooked, travelers: booking.travelers };
}
