import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/error-handler.js";
import type { CreateReviewInput } from "./reviews.schemas.js";

export async function createReview(passengerId: string, input: CreateReviewInput) {
  const { bookingId, rating, comment } = input;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, passengerId },
    include: { trip: { select: { driverId: true, driver: { select: { userId: true } } } } },
  });
  if (!booking) throw new AppError(404, "Booking not found");
  if (booking.status !== "completed") throw new AppError(400, "Can only review completed trips");
  if (booking.ratedDriver) throw new AppError(409, "Already reviewed this trip");

  const driverId = booking.trip.driverId;
  const driverUserId = booking.trip.driver.userId;

  const review = await prisma.$transaction(async (tx) => {
    const r = await tx.review.create({
      data: { bookingId, passengerId, driverId, rating, comment: comment ?? null },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });

    await tx.booking.update({ where: { id: bookingId }, data: { ratedDriver: true } });

    const avg = await tx.review.aggregate({
      where: { driver: { userId: driverUserId } },
      _avg: { rating: true },
    });

    await tx.user.update({
      where: { id: driverUserId },
      data: { rating: avg._avg.rating ?? undefined },
    });

    return r;
  });

  return review;
}

export async function getDriverReviews(driverId: string, page = 1, limit = 20) {
  return prisma.review.findMany({
    where: { driverId },
    include: { passenger: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
}
