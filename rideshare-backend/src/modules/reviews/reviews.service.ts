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

export async function listReviewsForAdmin({
  page = 1,
  limit = 50,
  search,
  rating,
}: {
  page?: number;
  limit?: number;
  search?: string;
  rating?: number;
}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const q = search?.trim();
  const where = {
    ...(rating ? { rating } : {}),
    ...(q
      ? {
          OR: [
            { comment: { contains: q, mode: "insensitive" as const } },
            { passenger: { fullName: { contains: q, mode: "insensitive" as const } } },
            { passenger: { phone: { contains: q, mode: "insensitive" as const } } },
            { driver: { user: { fullName: { contains: q, mode: "insensitive" as const } } } },
            { driver: { user: { phone: { contains: q, mode: "insensitive" as const } } } },
            { booking: { trip: { originName: { contains: q, mode: "insensitive" as const } } } },
            { booking: { trip: { destinationName: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [total, data] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        passenger: { select: { id: true, fullName: true, phone: true, email: true } },
        driver: {
          select: {
            id: true,
            user: { select: { id: true, fullName: true, phone: true, email: true, rating: true } },
          },
        },
        booking: {
          select: {
            id: true,
            tripId: true,
            boardingPoint: true,
            dropOffPoint: true,
            fareMwk: true,
            createdAt: true,
            trip: {
              select: {
                id: true,
                originName: true,
                destinationName: true,
                departureTime: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    data: data.map((review) => ({
      ...review,
      driver: {
        ...review.driver,
        user: {
          ...review.driver.user,
          rating: review.driver.user.rating?.toString() ?? null,
        },
      },
      booking: {
        ...review.booking,
        fareMwk: review.booking.fareMwk.toString(),
      },
    })),
    total,
    page: safePage,
    limit: safeLimit,
  };
}
