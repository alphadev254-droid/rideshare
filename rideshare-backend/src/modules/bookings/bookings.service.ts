import { BookingPaymentStatus, BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/error-handler.js";
import { generateCode, storeCode, hashCode, isCodeExpired } from "../../lib/secret-code.js";
import { sendSecretCode } from "../../lib/sms.js";
import { initiatePaychanguMobileMoneyRefund } from "../../lib/paychangu.js";
import { creditRefundConvenienceShare } from "../wallet/wallet.service.js";
import type { CreateBookingInput } from "./bookings.schemas.js";

const bookingDetailSelect = {
  id: true,
  tripId: true,
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
  trip: {
    select: {
      id: true,
      originName: true,
      destinationName: true,
      departureTime: true,
      baseFareMwk: true,
      status: true,
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

/** Leaner include for list queries — no payment/transaction data. */
const bookingAdminListSelect = {
  id: true,
  boardingPoint: true,
  dropOffPoint: true,
  seatsBooked: true,
  status: true,
  paymentStatus: true,
  fareMwk: true,
  travelers: { orderBy: { seatOrder: "asc" }, select: { id: true, fullName: true, phone: true, seatOrder: true, isPrimary: true } },
  createdAt: true,
  passenger: { select: { fullName: true, phone: true } },
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
    passenger: booking.passenger
      ? {
          ...booking.passenger,
          rating: booking.passenger.rating?.toString() ?? null,
        }
      : null,
    trip: booking.trip
      ? {
          ...booking.trip,
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
  });
  if (!booking) throw new AppError(404, "Booking not found or cannot be cancelled");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.trip.update({ where: { id: booking.tripId }, data: { availableSeats: { increment: booking.seatsBooked } } });

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
    const created = await tx.paymentRefund.create({
      data: {
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
        providerReference: booking.payment.providerReference,
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
        requestedAt: true,
        processedAt: true,
      },
    });

    return {
      refund: created,
      tripId: booking.tripId,
      driverId: booking.payment.driverId,
      passengerPhone: booking.payment.passenger.phone,
      paymentMethod: booking.payment.paymentMethod,
      seatsBooked: booking.seatsBooked,
    };
  });

  let providerPayload: Prisma.InputJsonValue;
  try {
    providerPayload = await initiatePaychanguMobileMoneyRefund({
      paymentMethod: pendingRefund.paymentMethod,
      passengerPhone: pendingRefund.passengerPhone,
      amountMwk: pendingRefund.refund.refundAmountMwk,
      chargeId: `RF-${pendingRefund.refund.id}`,
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

  const refund = await prisma.$transaction(async (tx) => {
    const current = await tx.paymentRefund.findUnique({
      where: { id: pendingRefund.refund.id },
      select: {
        id: true,
        paymentId: true,
        bookingId: true,
        driverId: true,
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
        requestedAt: true,
        processedAt: true,
      },
    });
    if (!current || current.status !== "processing") {
      throw new AppError(409, "Refund is no longer in a processable state");
    }

    const completed = await tx.paymentRefund.update({
      where: { id: current.id },
      data: {
        status: "completed",
        providerReference: `RF-${current.id}`,
        providerPayload,
        processedAt: new Date(),
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
        requestedAt: true,
        processedAt: true,
      },
    });

    await tx.payment.update({
      where: { id: current.paymentId },
      data: { status: "refunded", refundedAt: new Date() },
    });
    await tx.booking.update({
      where: { id: current.bookingId },
      data: { status: "cancelled", paymentStatus: "refunded", rawSecretCode: null },
    });
    await tx.trip.update({
      where: { id: pendingRefund.tripId },
      data: { availableSeats: { increment: pendingRefund.seatsBooked } },
    });

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

    return completed;
  });

  return formatRefund(refund);
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
