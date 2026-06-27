import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

function uniqueConstraintMessage(target: unknown): { error: string; code: string } {
  const fields = Array.isArray(target) ? target.map(String) : [];

  if (fields.includes("licenseNumber") || fields.includes("license_number")) {
    return {
      error: "A driver with this license number already exists",
      code: "DRIVER_LICENSE_EXISTS",
    };
  }

  if (fields.includes("plateNumber") || fields.includes("plate_number")) {
    return {
      error: "A vehicle with this plate number already exists",
      code: "VEHICLE_PLATE_EXISTS",
    };
  }

  if (fields.includes("phone")) {
    return { error: "Phone number already registered", code: "PHONE_EXISTS" };
  }

  if (fields.includes("email")) {
    return { error: "Email address already registered", code: "EMAIL_EXISTS" };
  }

  return {
    error: "A record with these details already exists",
    code: "UNIQUE_CONSTRAINT_FAILED",
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: "Validation error",
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const mapped = uniqueConstraintMessage(err.meta?.target);
      res.status(409).json({
        success: false,
        error: mapped.error,
        code: mapped.code,
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        error: "Record not found",
        code: "RECORD_NOT_FOUND",
      });
      return;
    }
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
}

