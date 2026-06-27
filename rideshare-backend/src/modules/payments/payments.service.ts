import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import axios from "axios";
import { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/error-handler.js";
import { codeExpiresAt, generateCode, hashCode } from "../../lib/secret-code.js";
import { sendCustomEmail, sendEmergencyAlert, sendSecretCode } from "../../lib/sms.js";
import { sendPushNotification } from "../../lib/fcm.js";
import { initiatePaychanguMobileMoneyRefund } from "../../lib/paychangu.js";
import { enqueueNotification, enqueuePaymentWebhook } from "../../jobs/queue.js";
import { bookingConfirmationEmail, bookingConfirmationText, driverBookingNotificationEmail, driverBookingNotificationText } from "../../lib/email-templates.js";
import { handlePaychanguPayoutWebhook } from "../wallet/wallet.service.js";
import type { InitiatePaymentInput, InitiateRidePaymentInput } from "./payments.schemas.js";

type RateValue = string | number | Prisma.Decimal;

type PendingPaymentRow = {
  id: string;
  bookingId: string | null;
  tripId: string | null;
  passengerId: string;
  driverId: string;
  txRef: string;
  paymentMethod: PaymentMethod;
  fareAmountMwk: bigint;
  providerFeeMwk: bigint;
  providerFeeRate: RateValue;
  systemFeeMwk: bigint;
  systemFeeRate: RateValue;
  customerAmountMwk: bigint;
  driverAmountMwk: bigint;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  gatewayReference: string | null;
  boardingPoint: string | null;
  dropOffPoint: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PaymentRow = {
  id: string;
  bookingId: string;
  passengerId: string;
  driverId: string;
  grossAmountMwk: bigint;
  fareAmountMwk: bigint;
  providerFeeMwk: bigint;
  providerFeeRate: RateValue;
  systemFeeMwk: bigint;
  systemFeeRate: RateValue;
  customerAmountMwk: bigint;
  commissionMwk: bigint;
  commissionRate: RateValue;
  netAmountMwk: bigint;
  paymentMethod: PaymentMethod;
  gatewayRef: string | null;
  providerReference: string | null;
  status: string;
  escrowHeldAt: Date | null;
  releasedAt: Date | null;
  refundedAt: Date | null;
  verifiedAt: Date | null;
  createdAt: Date;
  passengerName?: string | null;
  passengerPhone?: string | null;
  driverName?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  departureTime?: Date | null;
  passenger?: { fullName: string; phone: string | null; email: string | null };
  driver?: { user: { fullName: string; email: string | null } };
  booking?: { trip: { originName: string; destinationName: string; departureTime: Date } };
};

type BookingNotification = {
  bookingId: string;
  rawCode: string;
  passengerPhone: string | null;
  passengerName: string;
  emergencyContactPhone: string | null;
  fcmToken: string | null;
  driverName: string;
  route: string;
};

function paychanguHeaders() {
  return {
    Authorization: `Bearer ${env.PAYCHANGU_SECRET_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function getAppOrigin() {
  const rawOrigin = env.APP_URL || env.FRONTEND_URL || "http://localhost:8080";
  try {
    const url = new URL(rawOrigin.trim());
    if (url.hostname === "localhost" && !url.port) url.port = "8080";
    return url.origin;
  } catch {
    return "http://localhost:8080";
  }
}

function toMoney(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return "0";
  return typeof value === "bigint" ? value.toString() : String(value);
}

function toRate(value: RateValue) {
  return value.toString();
}

function toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const paymentInclude = {
  passenger: { select: { fullName: true, phone: true, email: true } },
  driver: { select: { user: { select: { fullName: true, email: true } } } },
  booking: {
    select: {
      trip: { select: { originName: true, destinationName: true, departureTime: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

function formatPending(row: PendingPaymentRow) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    tripId: row.tripId,
    passengerId: row.passengerId,
    driverId: row.driverId,
    txRef: row.txRef,
    paymentMethod: row.paymentMethod,
    fareAmountMwk: row.fareAmountMwk.toString(),
    providerFeeMwk: row.providerFeeMwk.toString(),
    providerFeeRate: toRate(row.providerFeeRate),
    systemFeeMwk: row.systemFeeMwk.toString(),
    systemFeeRate: toRate(row.systemFeeRate),
    customerAmountMwk: row.customerAmountMwk.toString(),
    driverAmountMwk: row.driverAmountMwk.toString(),
    currency: row.currency,
    status: row.status,
    checkoutUrl: row.checkoutUrl,
    gatewayReference: row.gatewayReference,
    boardingPoint: row.boardingPoint,
    dropOffPoint: row.dropOffPoint,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatPayment(row: PaymentRow) {
  const base = formatPaymentBase(row);
  return {
    ...base,
    passengerId: row.passengerId,
    driverId: row.driverId,
    grossAmountMwk: row.grossAmountMwk.toString(),
    systemFeeMwk: row.systemFeeMwk.toString(),
    systemFeeRate: toRate(row.systemFeeRate),
    commissionMwk: row.commissionMwk.toString(),
    commissionRate: toRate(row.commissionRate),
    netAmountMwk: row.netAmountMwk.toString(),
    driverAmountMwk: row.netAmountMwk.toString(),
    providerReference: row.providerReference,
    passengerPhone: row.passengerPhone ?? row.passenger?.phone,
    passengerEmail: row.passenger?.email ?? null,
  };
}

function formatPaymentBase(row: PaymentRow) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    fareAmountMwk: row.fareAmountMwk.toString(),
    providerFeeMwk: row.providerFeeMwk.toString(),
    providerFeeRate: toRate(row.providerFeeRate),
    customerAmountMwk: row.customerAmountMwk.toString(),
    paymentMethod: row.paymentMethod,
    gatewayRef: row.gatewayRef,
    status: row.status,
    escrowHeldAt: row.escrowHeldAt,
    releasedAt: row.releasedAt,
    refundedAt: row.refundedAt,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
    passengerName: row.passengerName ?? row.passenger?.fullName,
    driverName: row.driverName ?? row.driver?.user.fullName,
    route:
      (row.originName ?? row.booking?.trip.originName) && (row.destinationName ?? row.booking?.trip.destinationName)
        ? `${row.originName ?? row.booking?.trip.originName} -> ${row.destinationName ?? row.booking?.trip.destinationName}`
        : null,
    originName: row.originName ?? row.booking?.trip.originName,
    destinationName: row.destinationName ?? row.booking?.trip.destinationName,
    departureTime: row.departureTime ?? row.booking?.trip.departureTime,
  };
}

function maskPhone(phone?: string | null) {
  if (!phone) return null;
  const visible = phone.replace(/\s/g, "");
  if (visible.length <= 5) return `${visible.slice(0, 2)}***`;
  return `${visible.slice(0, 3)}***${visible.slice(-2)}`;
}

function formatPassengerPayment(row: PaymentRow) {
  const base = formatPaymentBase(row);
  return {
    id: base.id,
    fareAmountMwk: base.fareAmountMwk,
    providerFeeMwk: base.providerFeeMwk,
    providerFeeRate: base.providerFeeRate,
    customerAmountMwk: base.customerAmountMwk,
    paymentMethod: base.paymentMethod,
    status: base.status,
    verifiedAt: base.verifiedAt,
    createdAt: base.createdAt,
    route: base.route,
    originName: base.originName,
    destinationName: base.destinationName,
    departureTime: base.departureTime,
    driverName: base.driverName,
  };
}

function formatDriverPayment(row: PaymentRow) {
  const base = formatPaymentBase(row);
  return {
    id: base.id,
    bookingId: base.bookingId,
    fareAmountMwk: base.fareAmountMwk,
    customerAmountMwk: base.customerAmountMwk,
    systemFeeMwk: row.systemFeeMwk.toString(),
    systemFeeRate: toRate(row.systemFeeRate),
    driverAmountMwk: row.netAmountMwk.toString(),
    paymentMethod: base.paymentMethod,
    gatewayRef: base.gatewayRef,
    status: base.status,
    escrowHeldAt: base.escrowHeldAt,
    releasedAt: base.releasedAt,
    refundedAt: base.refundedAt,
    verifiedAt: base.verifiedAt,
    createdAt: base.createdAt,
    passengerName: base.passengerName,
    passengerPhone: maskPhone(row.passengerPhone ?? row.passenger?.phone),
    route: base.route,
    originName: base.originName,
    destinationName: base.destinationName,
    departureTime: base.departureTime,
  };
}

function paymentEmailDetails(row: PaymentRow) {
  const route = `${row.originName ?? row.booking?.trip.originName ?? "Trip"} -> ${
    row.destinationName ?? row.booking?.trip.destinationName ?? "Destination"
  }`;
  const departure = row.departureTime ?? row.booking?.trip.departureTime ?? null;

  return {
    route,
    departureLabel: departure ? departure.toLocaleString("en-MW", { dateStyle: "medium", timeStyle: "short" }) : "Not specified",
    passengerName: row.passengerName ?? row.passenger?.fullName ?? "Passenger",
    passengerEmail: row.passenger?.email ?? null,
    driverName: row.driverName ?? row.driver?.user.fullName ?? "Driver",
    driverEmail: row.driver?.user.email ?? null,
    customerAmount: toMoney(row.customerAmountMwk),
    fareAmount: toMoney(row.fareAmountMwk),
    driverAmount: toMoney(row.netAmountMwk),
    bookingId: row.bookingId,
    txRef: row.gatewayRef ?? row.id,
  };
}

async function sendSuccessfulPaymentEmails(row: PaymentRow) {
  try {
    const details = paymentEmailDetails(row);

    const passengerTemplateParams = {
      passengerName: details.passengerName,
      route: details.route,
      departureLabel: details.departureLabel,
      customerAmount: details.customerAmount,
      bookingId: details.bookingId,
      txRef: details.txRef,
    };

    const driverTemplateParams = {
      driverName: details.driverName,
      passengerName: details.passengerName,
      route: details.route,
      departureLabel: details.departureLabel,
      fareAmount: details.fareAmount,
      driverAmount: details.driverAmount,
      bookingId: details.bookingId,
      txRef: details.txRef,
    };

    if (details.passengerEmail) {
      await enqueueNotification({
        type: "email",
        to: details.passengerEmail,
        subject: "Your ChepetsaRide booking is confirmed",
        text: bookingConfirmationText(passengerTemplateParams),
        html: bookingConfirmationEmail(passengerTemplateParams),
      });
    }

    if (details.driverEmail) {
      await enqueueNotification({
        type: "email",
        to: details.driverEmail,
        subject: "A passenger booked and paid for your ride",
        text: driverBookingNotificationText(driverTemplateParams),
        html: driverBookingNotificationEmail(driverTemplateParams),
      });
    }
  } catch (err) {
    console.error("[QUEUE] Failed to enqueue payment emails, sending inline:", (err as Error).message);
    await sendSuccessfulPaymentEmailsInline(row);
  }
}

async function enqueueOrRunNotification(job: Parameters<typeof enqueueNotification>[0], fallback: () => Promise<void>) {
  try {
    await enqueueNotification(job);
  } catch (err) {
    console.error("[QUEUE] Failed to enqueue notification, running inline:", (err as Error).message);
    await fallback();
  }
}

async function sendSuccessfulPaymentEmailsInline(row: PaymentRow) {
  const details = paymentEmailDetails(row);
  const tasks: Promise<void>[] = [];

  if (details.passengerEmail) {
    tasks.push(
      sendCustomEmail(
        details.passengerEmail,
        "Your ChepetsaRide booking is confirmed",
        `Hi ${details.passengerName},\n\nYour payment was successful and your ride booking is confirmed.\n\nRoute: ${details.route}\nDeparture: ${details.departureLabel}\nAmount paid: MWK ${details.customerAmount}\nBooking ID: ${details.bookingId}\nTransaction ref: ${details.txRef}\n\nYour boarding code has been sent separately. Share it only with your driver at the boarding point.\n\nThank you for using ChepetsaRide.`,
      ),
    );
  }

  if (details.driverEmail) {
    tasks.push(
      sendCustomEmail(
        details.driverEmail,
        "A passenger booked and paid for your ride",
        `Hi ${details.driverName},\n\nA passenger has successfully paid and booked your ride.\n\nPassenger: ${details.passengerName}\nRoute: ${details.route}\nDeparture: ${details.departureLabel}\nFare: MWK ${details.fareAmount}\nDriver amount after fees: MWK ${details.driverAmount}\nBooking ID: ${details.bookingId}\nTransaction ref: ${details.txRef}\n\nPlease confirm the passenger at boarding using their boarding code.`,
      ),
    );
  }

  await Promise.allSettled(tasks);
}

function calculatePaymentBreakdown(fareAmountMwk: number) {
  const providerFeeRate = env.PAYCHANGU_TRANSACTION_FEE_RATE;
  const systemFeeRate = env.SYSTEM_FEE_RATE;
  const providerFeeMwk = Math.round(fareAmountMwk * providerFeeRate);
  const systemFeeMwk = Math.round(fareAmountMwk * systemFeeRate);
  return {
    fareAmountMwk,
    providerFeeMwk,
    providerFeeRate,
    systemFeeMwk,
    systemFeeRate,
    customerAmountMwk: fareAmountMwk + providerFeeMwk,
    driverAmountMwk: fareAmountMwk - systemFeeMwk,
  };
}

async function createPaychanguCheckout(params: {
  txRef: string;
  amount: number;
  currency: string;
  email: string;
  firstName: string;
  lastName: string;
  callbackUrl: string;
  returnUrl: string;
  meta: Record<string, string>;
}) {
  try {
    const res = await axios.post(
      `${env.PAYCHANGU_BASE_URL}/payment`,
      {
        tx_ref: params.txRef,
        amount: params.amount,
        currency: params.currency,
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        callback_url: params.callbackUrl,
        return_url: params.returnUrl,
        customization: {
          title: "ChepetsaRide booking payment",
          description: "Ride fare and processing fee",
        },
        meta: params.meta,
      },
      { headers: paychanguHeaders() },
    );

    const checkoutUrl = res.data?.data?.checkout_url;
    if (!checkoutUrl) throw new AppError(502, "PayChangu did not return a checkout URL");
    return checkoutUrl as string;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message =
        (error.response?.data as { message?: string } | undefined)?.message ??
        "PayChangu rejected the payment request";
      throw new AppError(error.response?.status === 400 ? 400 : 502, message);
    }
    throw error;
  }
}

function assertPaychanguMinimum(amountMwk: number) {
  if (amountMwk < env.PAYCHANGU_MIN_AMOUNT_MWK) {
    throw new AppError(
      400,
      `PayChangu requires payment amount to be at least MK ${env.PAYCHANGU_MIN_AMOUNT_MWK}`,
    );
  }
}

async function verifyPaychanguTransaction(txRef: string) {
  const res = await axios.get(`${env.PAYCHANGU_BASE_URL}/verify-payment/${txRef}`, {
    headers: paychanguHeaders(),
  });
  return res.data?.data as Record<string, unknown> | undefined;
}

function statusIsSuccessful(status: unknown) {
  return ["success", "successful"].includes(String(status ?? "").toLowerCase());
}

function statusIsFailed(status: unknown) {
  return ["failed", "cancelled", "canceled"].includes(String(status ?? "").toLowerCase());
}

function verifyWebhookSignature(rawBody: Buffer, signature: string) {
  if (!env.PAYCHANGU_WEBHOOK_SECRET) return;
  if (!signature) throw new AppError(401, "Missing webhook signature");

  const expected = createHmac("sha256", env.PAYCHANGU_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new AppError(401, "Invalid webhook signature");
  }
}

async function getPendingByTxRef(txRef: string) {
  return prisma.pendingPayment.findUnique({ where: { txRef } });
}

async function getPaymentByTxRef(txRef: string) {
  return prisma.payment.findFirst({
    where: {
      OR: [
        { gatewayRef: txRef },
        ...(isUuid(txRef) ? [{ id: txRef }] : []),
      ],
    },
    include: paymentInclude,
  });
}

export async function initiatePayment(
  passengerId: string,
  input: InitiatePaymentInput & { callbackUrl?: string; returnUrl?: string },
) {
  const { bookingId, method } = input;
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, passengerId },
    include: {
      trip: { select: { driverId: true, originName: true, destinationName: true } },
      passenger: { select: { phone: true, fullName: true, email: true } },
    },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.paymentStatus !== "unpaid") throw new AppError(400, "Booking already paid or in escrow");

  const existingPayment = await prisma.payment.findUnique({ where: { bookingId } });
  if (existingPayment) throw new AppError(400, "Booking already has a finalized payment");

  const breakdown = calculatePaymentBreakdown(Number(booking.fareMwk));
  assertPaychanguMinimum(breakdown.customerAmountMwk);
  const txRef = `RS-${randomUUID()}`;
  const [firstName = "Customer", ...rest] = (booking.passenger.fullName ?? "Customer").split(" ");
  const lastName = rest.join(" ") || firstName;
  const appOrigin = getAppOrigin();
  const callbackUrl = input.callbackUrl ?? `${appOrigin}/app/payments/callback`;
  const returnUrl = input.returnUrl ?? `${appOrigin}/app/bookings/${bookingId}`;

  const checkoutUrl = await createPaychanguCheckout({
    txRef,
    amount: breakdown.customerAmountMwk,
    currency: "MWK",
    email: booking.passenger.email ?? `${passengerId}@rideshare.mw`,
    firstName,
    lastName,
    callbackUrl,
    returnUrl,
    meta: {
      bookingId,
      passengerId,
      driverId: booking.trip.driverId,
      route: `${booking.trip.originName} -> ${booking.trip.destinationName}`,
    },
  });

  const pending = await prisma.pendingPayment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      passengerId,
      driverId: booking.trip.driverId,
      txRef,
      paymentMethod: method,
      fareAmountMwk: BigInt(breakdown.fareAmountMwk),
      providerFeeMwk: BigInt(breakdown.providerFeeMwk),
      providerFeeRate: breakdown.providerFeeRate,
      systemFeeMwk: BigInt(breakdown.systemFeeMwk),
      systemFeeRate: breakdown.systemFeeRate,
      customerAmountMwk: BigInt(breakdown.customerAmountMwk),
      driverAmountMwk: BigInt(breakdown.driverAmountMwk),
      currency: "MWK",
      status: "pending",
      checkoutUrl,
    },
    update: {
      txRef,
      paymentMethod: method,
      fareAmountMwk: BigInt(breakdown.fareAmountMwk),
      providerFeeMwk: BigInt(breakdown.providerFeeMwk),
      providerFeeRate: breakdown.providerFeeRate,
      systemFeeMwk: BigInt(breakdown.systemFeeMwk),
      systemFeeRate: breakdown.systemFeeRate,
      customerAmountMwk: BigInt(breakdown.customerAmountMwk),
      driverAmountMwk: BigInt(breakdown.driverAmountMwk),
      status: "pending",
      checkoutUrl,
      gatewayReference: null,
      providerPayload: Prisma.DbNull,
      failureReason: null,
      verifiedAt: null,
    },
  });

  return { ...formatPending(pending), paymentUrl: checkoutUrl, checkoutUrl };
}

export async function initiateRidePayment(
  passengerId: string,
  input: InitiateRidePaymentInput & { callbackUrl?: string; returnUrl?: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: passengerId },
    select: {
      fullName: true,
      phone: true,
      email: true,
      emergencyContactPhone: true,
    },
  });
  if (!user) throw new AppError(404, "User not found");
  if (!user.emergencyContactPhone) {
    throw new AppError(400, "Emergency contact is required before payment");
  }

  const trip = await prisma.trip.findUnique({
    where: { id: input.tripId },
    select: {
      id: true,
      driverId: true,
      originName: true,
      destinationName: true,
      status: true,
      availableSeats: true,
      baseFareMwk: true,
    },
  });
  if (!trip) throw new AppError(404, "Trip not found");
  if (trip.status !== "scheduled") throw new AppError(400, "Trip is not accepting bookings");
  if (trip.availableSeats < 1) throw new AppError(400, "No seats available");

  const existingBooking = await prisma.booking.findFirst({
    where: {
      tripId: input.tripId,
      passengerId,
      status: { notIn: ["cancelled"] },
    },
  });
  if (existingBooking) throw new AppError(409, "You already have a booking for this trip");

  const fareAmount = Number(trip.baseFareMwk ?? BigInt(0));
  const breakdown = calculatePaymentBreakdown(fareAmount);
  assertPaychanguMinimum(breakdown.customerAmountMwk);
  const txRef = `RS-${randomUUID()}`;
  const [firstName = "Customer", ...rest] = (user.fullName ?? "Customer").split(" ");
  const lastName = rest.join(" ") || firstName;
  const appOrigin = getAppOrigin();
  const callbackUrl = input.callbackUrl ?? `${appOrigin}/app/payments/callback`;
  const returnUrl = input.returnUrl ?? `${appOrigin}/app/payments/callback?tx_ref=${txRef}`;

  const checkoutUrl = await createPaychanguCheckout({
    txRef,
    amount: breakdown.customerAmountMwk,
    currency: "MWK",
    email: user.email ?? `${passengerId}@rideshare.mw`,
    firstName,
    lastName,
    callbackUrl,
    returnUrl,
    meta: {
      tripId: input.tripId,
      passengerId,
      driverId: trip.driverId,
      route: `${trip.originName} -> ${trip.destinationName}`,
    },
  });

  const pending = await prisma.pendingPayment.create({
    data: {
      tripId: input.tripId,
      passengerId,
      driverId: trip.driverId,
      txRef,
      paymentMethod: input.method,
      boardingPoint: input.boardingPoint,
      dropOffPoint: input.dropOffPoint ?? trip.destinationName,
      fareAmountMwk: BigInt(breakdown.fareAmountMwk),
      providerFeeMwk: BigInt(breakdown.providerFeeMwk),
      providerFeeRate: breakdown.providerFeeRate,
      systemFeeMwk: BigInt(breakdown.systemFeeMwk),
      systemFeeRate: breakdown.systemFeeRate,
      customerAmountMwk: BigInt(breakdown.customerAmountMwk),
      driverAmountMwk: BigInt(breakdown.driverAmountMwk),
      currency: "MWK",
      status: "pending",
      checkoutUrl,
    },
  });

  return { ...formatPending(pending), paymentUrl: checkoutUrl, checkoutUrl };
}

async function finalizeVerifiedPayment(
  pending: PendingPaymentRow,
  verification: Record<string, unknown>,
) {
  if (!statusIsSuccessful(verification.status)) return null;
  if (verification.tx_ref && verification.tx_ref !== pending.txRef) {
    throw new AppError(400, "Payment reference mismatch");
  }
  if (verification.currency && verification.currency !== pending.currency) {
    throw new AppError(400, "Payment currency mismatch");
  }
  if (Number(verification.amount ?? 0) < Number(pending.customerAmountMwk)) {
    throw new AppError(400, "Payment amount is lower than expected");
  }

  const providerReference = String(verification.reference ?? "");
  let bookingId = pending.bookingId;
  let notification: BookingNotification | null = null;
  const rawCode = pending.bookingId ? null : generateCode();
  const hashedCode = rawCode ? await hashCode(rawCode) : null;

  const row = await prisma.$transaction(async (tx) => {
    if (!bookingId) {
      if (!pending.tripId || !pending.boardingPoint) {
        await tx.pendingPayment.update({
          where: { id: pending.id },
          data: {
            status: "paid_booking_failed",
            failureReason: "Missing trip or boarding details",
            providerPayload: toJson(verification),
          },
        });
        return null;
      }

      const existingBooking = await tx.booking.findFirst({
        where: {
          tripId: pending.tripId,
          passengerId: pending.passengerId,
          status: { notIn: ["cancelled"] },
        },
        select: { id: true },
      });
      if (existingBooking) {
        await tx.pendingPayment.update({
          where: { id: pending.id },
          data: {
            status: "paid_booking_failed",
            failureReason: "Passenger already has a booking for this trip",
            providerPayload: toJson(verification),
          },
        });
        return null;
      }

      const seatUpdate = await tx.trip.updateMany({
        where: { id: pending.tripId, status: "scheduled", availableSeats: { gt: 0 } },
        data: { availableSeats: { decrement: 1 } },
      });
      if (seatUpdate.count === 0) {
        await tx.pendingPayment.update({
          where: { id: pending.id },
          data: {
            status: "paid_booking_failed",
            failureReason: "No seats available after payment verification",
            providerPayload: toJson(verification),
          },
        });
        return null;
      }

      const createdBooking = await tx.booking.create({
        data: {
          tripId: pending.tripId,
          passengerId: pending.passengerId,
          boardingPoint: pending.boardingPoint,
          dropOffPoint: pending.dropOffPoint,
          secretCode: hashedCode!,
          rawSecretCode: rawCode!,
          codeExpiresAt: codeExpiresAt(),
          fareMwk: pending.fareAmountMwk,
          status: "confirmed",
          paymentStatus: "held_in_escrow",
        },
        select: {
          id: true,
          passenger: {
            select: {
              phone: true,
              fullName: true,
              emergencyContactPhone: true,
              fcmToken: true,
            },
          },
          trip: {
            select: {
              originName: true,
              destinationName: true,
              driver: { select: { user: { select: { fullName: true } } } },
            },
          },
        },
      });

      bookingId = createdBooking.id;
      notification = {
        bookingId: createdBooking.id,
        rawCode: rawCode!,
        passengerPhone: createdBooking.passenger.phone,
        passengerName: createdBooking.passenger.fullName,
        emergencyContactPhone: createdBooking.passenger.emergencyContactPhone,
        fcmToken: createdBooking.passenger.fcmToken,
        driverName: createdBooking.trip.driver.user.fullName,
        route: `${createdBooking.trip.originName} -> ${createdBooking.trip.destinationName}`,
      };
    }

    const now = new Date();
    const payment = await tx.payment.upsert({
      where: { bookingId },
      create: {
        bookingId,
        passengerId: pending.passengerId,
        driverId: pending.driverId,
        grossAmountMwk: pending.fareAmountMwk,
        fareAmountMwk: pending.fareAmountMwk,
        providerFeeMwk: pending.providerFeeMwk,
        providerFeeRate: pending.providerFeeRate,
        systemFeeMwk: pending.systemFeeMwk,
        systemFeeRate: pending.systemFeeRate,
        customerAmountMwk: pending.customerAmountMwk,
        commissionMwk: pending.systemFeeMwk,
        commissionRate: pending.systemFeeRate,
        netAmountMwk: pending.driverAmountMwk,
        paymentMethod: pending.paymentMethod,
        gatewayRef: pending.txRef,
        provider: "paychangu",
        providerReference: providerReference || null,
        providerPayload: toJson(verification),
        status: "escrow_held",
        escrowHeldAt: now,
        verifiedAt: now,
      },
      update: {
        providerPayload: toJson(verification),
        verifiedAt: now,
      },
      include: paymentInclude,
    });

    if (pending.bookingId) {
      await tx.booking.update({
        where: { id: pending.bookingId },
        data: { paymentStatus: "held_in_escrow", status: "confirmed" },
      });
    }

    await tx.pendingPayment.update({
      where: { id: pending.id },
      data: {
        status: "verified",
        gatewayReference: providerReference || null,
        bookingId,
        providerPayload: toJson(verification),
        verifiedAt: now,
      },
    });

    return payment;
  });

  if (!row) return null;

  const sentNotification = notification as BookingNotification | null;
  await sendSuccessfulPaymentEmails(row);

  if (sentNotification) {
    await Promise.allSettled([
      enqueueOrRunNotification(
        {
          type: "secret_code",
          phone: sentNotification.passengerPhone ?? "",
          code: sentNotification.rawCode,
          driverName: sentNotification.driverName,
          route: sentNotification.route,
        },
        () => sendSecretCode(sentNotification.passengerPhone ?? "", sentNotification.rawCode, sentNotification.driverName, sentNotification.route),
      ),
      sentNotification.emergencyContactPhone
        ? enqueueOrRunNotification(
            {
              type: "emergency_alert",
              phone: sentNotification.emergencyContactPhone,
              passengerName: sentNotification.passengerName,
              route: sentNotification.route,
              tripId: sentNotification.bookingId,
            },
            () =>
              sendEmergencyAlert(
                sentNotification.emergencyContactPhone ?? "",
                sentNotification.passengerName,
                sentNotification.route,
                sentNotification.bookingId,
              ),
          )
        : Promise.resolve(),
      sentNotification.fcmToken
        ? enqueueOrRunNotification(
            {
              type: "push",
              token: sentNotification.fcmToken,
              title: "Booking confirmed",
              body: `Your secret boarding code: ${sentNotification.rawCode}. Keep this safe!`,
              data: { bookingId: sentNotification.bookingId, code: sentNotification.rawCode },
            },
            () =>
              sendPushNotification(
                sentNotification.fcmToken ?? "",
                "Booking confirmed",
                `Your secret boarding code: ${sentNotification.rawCode}. Keep this safe!`,
                { bookingId: sentNotification.bookingId, code: sentNotification.rawCode },
              ),
          )
        : Promise.resolve(),
    ]);
  }

  return row;
}

export async function verifyAndFinalizeByTxRef(txRef: string) {
  const finalized = await getPaymentByTxRef(txRef);
  if (finalized) return { state: "finalized", transaction: formatPayment(finalized) };

  const pending = await getPendingByTxRef(txRef);
  if (!pending) throw new AppError(404, "Pending transaction not found");

  const verification = await verifyPaychanguTransaction(txRef);
  if (!verification) return { state: "pending", transaction: formatPending(pending) };

  if (statusIsFailed(verification.status)) {
    await prisma.pendingPayment.update({
      where: { id: pending.id },
      data: { status: "failed", providerPayload: toJson(verification) },
    });
    return { state: "failed", transaction: formatPending({ ...pending, status: "failed" }) };
  }

  if (!statusIsSuccessful(verification.status)) {
    return { state: "pending", transaction: formatPending(pending) };
  }

  const payment = await finalizeVerifiedPayment(pending, verification);
  if (!payment) {
    const updatedPending = await getPendingByTxRef(txRef);
    return {
      state: "failed",
      transaction: updatedPending ? formatPending(updatedPending) : null,
    };
  }
  return { state: "finalized", transaction: formatPayment(payment) };
}

export async function handlePaychanguWebhook(rawBody: Buffer, signature: string) {
  verifyWebhookSignature(rawBody, signature);
  const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
  const nested = payload.data && typeof payload.data === "object"
    ? (payload.data as Record<string, unknown>)
    : {};

  // If this is a payout webhook, route it to the wallet service
  const eventType = String(payload.event_type ?? nested.event_type ?? "");
  if (eventType === "api.payout" || eventType === "payout") {
    // Use the inner data payload if present, otherwise the full payload
    const payoutPayload = Object.keys(nested).length > 0 ? nested : payload;
    const result = await handlePaychanguPayoutWebhook(payoutPayload);
    return { received: true, payout: result };
  }

  const txRef = String(payload.tx_ref ?? nested.tx_ref ?? "");
  if (!txRef) return { received: true };
  await enqueuePaymentWebhook(txRef);
  return { received: true, queued: true, txRef };
}

export async function verifyPayment(paymentIdOrTxRef: string, userId: string) {
  const result = await verifyAndFinalizeByTxRef(paymentIdOrTxRef);
  const transaction = result.transaction as { passengerId?: string; driverId?: string; bookingId?: string } | null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, driverProfile: { select: { id: true } } } });
  if (
    user?.role !== "admin" &&
    transaction?.passengerId !== userId &&
    transaction?.driverId !== user?.driverProfile?.id
  ) {
    throw new AppError(403, "You cannot view this transaction");
  }
  if (result.state !== "finalized" || !transaction?.bookingId) return result;

  const payment = await prisma.payment.findUnique({
    where: { bookingId: transaction.bookingId },
    include: paymentInclude,
  });
  if (!payment) return result;
  return {
    ...result,
    transaction:
      user?.role === "admin"
        ? formatPayment(payment)
        : payment.driverId === user?.driverProfile?.id
          ? formatDriverPayment(payment)
          : formatPassengerPayment(payment),
  };
}

export async function listPassengerTransactions(userId: string, page = 1, limit = 20) {
  const rows = await prisma.payment.findMany({
    where: { passengerId: userId },
    include: paymentInclude,
    orderBy: { createdAt: "desc" },
    skip: (Math.max(page, 1) - 1) * limit,
    take: limit,
  });
  return rows.map(formatPassengerPayment);
}

export async function listDriverTransactions(userId: string, page = 1, limit = 20) {
  const driver = await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) throw new AppError(404, "Driver profile not found", "DRIVER_NOT_ONBOARDED");
  const rows = await prisma.payment.findMany({
    where: { driverId: driver.id },
    include: paymentInclude,
    orderBy: { createdAt: "desc" },
    skip: (Math.max(page, 1) - 1) * limit,
    take: limit,
  });
  return rows.map(formatDriverPayment);
}

export async function listAdminTransactions({
  page = 1,
  limit = 70,
  status,
  search,
}: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const where: Prisma.PaymentWhereInput = {};
  if (status) {
    if (!Object.values(PaymentStatus).includes(status as PaymentStatus)) {
      throw new AppError(400, "Invalid payment status");
    }
    where.status = status as PaymentStatus;
  }
  if (search) {
    where.OR = [
      { passenger: { fullName: { contains: search, mode: "insensitive" } } },
      { driver: { user: { fullName: { contains: search, mode: "insensitive" } } } },
      { gatewayRef: { contains: search, mode: "insensitive" } },
      { providerReference: { contains: search, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.payment.findMany({
    where,
    include: paymentInclude,
    orderBy: { createdAt: "desc" },
    skip: (Math.max(page, 1) - 1) * safeLimit,
    take: safeLimit,
  });
  return rows.map(formatPayment);
}

export async function getTransactionById(id: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, driverProfile: { select: { id: true } } },
  });
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: paymentInclude,
  });
  if (!payment) throw new AppError(404, "Transaction not found");
  if (
    user?.role !== "admin" &&
    payment.passengerId !== userId &&
    payment.driverId !== user?.driverProfile?.id
  ) {
    throw new AppError(403, "You cannot view this transaction");
  }
  if (user?.role === "admin") return formatPayment(payment);
  if (payment.driverId === user?.driverProfile?.id) return formatDriverPayment(payment);
  return formatPassengerPayment(payment);
}

export async function getPaymentStatus(bookingId: string, userId: string) {
  const caller = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const payment = await prisma.payment.findFirst({
    where: {
      bookingId,
      ...(caller?.role === "admin" ? {} : { passengerId: userId }),
    },
    include: paymentInclude,
  });
  if (payment) {
    if (caller?.role === "admin") return formatPayment(payment);
    return formatPassengerPayment(payment);
  }

  const pending = await prisma.pendingPayment.findFirst({
    where: {
      bookingId,
      ...(caller?.role === "admin" ? {} : { passengerId: userId }),
    },
  });
  if (!pending) throw new AppError(404, "Payment not found");
  return formatPending(pending);
}

export async function adminRefund(paymentId: string) {
  const pendingRefund = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, status: "escrow_held" },
      select: {
        id: true,
        bookingId: true,
        passengerId: true,
        driverId: true,
        customerAmountMwk: true,
        paymentMethod: true,
        gatewayRef: true,
        providerReference: true,
        passenger: { select: { phone: true } },
        booking: {
          select: {
            tripId: true,
            codeUsed: true,
            status: true,
            paymentStatus: true,
            trip: { select: { status: true, startedAt: true } },
          },
        },
        refunds: {
          where: { status: { in: ["requested", "processing", "completed"] } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!payment) throw new AppError(404, "Escrow-held payment not found or not refundable");
    if (payment.refunds.length > 0) throw new AppError(400, "A refund already exists for this payment");
    if (payment.booking.paymentStatus !== "held_in_escrow") {
      throw new AppError(400, "Only escrow-held bookings can be automatically refunded");
    }
    if (
      payment.booking.codeUsed ||
      payment.booking.status === "authenticated" ||
      payment.booking.trip.startedAt ||
      ["in_transit", "completed", "cancelled"].includes(payment.booking.trip.status)
    ) {
      throw new AppError(400, "This ride has already started or boarded. Use a manual dispute adjustment flow");
    }

    const refund = await tx.paymentRefund.create({
      data: {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        passengerId: payment.passengerId,
        driverId: payment.driverId,
        status: "processing",
        reason: "Admin refund",
        originalCustomerAmountMwk: payment.customerAmountMwk,
        refundableBaseMwk: payment.customerAmountMwk,
        convenienceFeeRate: 0,
        convenienceFeeMwk: 0,
        driverConvenienceShareRate: 0,
        driverConvenienceShareMwk: 0,
        platformConvenienceFeeMwk: 0,
        refundAmountMwk: payment.customerAmountMwk,
        providerReference: payment.providerReference ?? payment.gatewayRef,
      },
      select: {
        id: true,
        paymentId: true,
        bookingId: true,
        refundAmountMwk: true,
      },
    });

    return {
      refund,
      tripId: payment.booking.tripId,
      passengerPhone: payment.passenger.phone,
      paymentMethod: payment.paymentMethod,
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

  await prisma.$transaction([
    prisma.paymentRefund.update({
      where: { id: pendingRefund.refund.id },
      data: {
        status: "completed",
        providerReference: `RF-${pendingRefund.refund.id}`,
        providerPayload,
        processedAt: new Date(),
      },
    }),
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: "refunded", refundedAt: new Date() },
    }),
    prisma.booking.update({
      where: { id: pendingRefund.refund.bookingId },
      data: { status: "cancelled", paymentStatus: "refunded", rawSecretCode: null },
    }),
    prisma.trip.update({
      where: { id: pendingRefund.tripId },
      data: { availableSeats: { increment: 1 } },
    }),
  ]);

  return {
    id: paymentId,
    status: "refunded",
    bookingId: pendingRefund.refund.bookingId,
    refundId: pendingRefund.refund.id,
    refundAmountMwk: pendingRefund.refund.refundAmountMwk.toString(),
  };
}
