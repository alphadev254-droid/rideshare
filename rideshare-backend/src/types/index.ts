import type { Request } from "express";

export type UserRole = "passenger" | "driver" | "admin";
export type ComfortClass = "economy" | "standard" | "comfort";
export type TripStatus =
  | "scheduled"
  | "boarding"
  | "in_transit"
  | "completed"
  | "cancelled";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "authenticated"
  | "completed"
  | "cancelled"
  | "no_show";
export type PaymentStatus =
  | "initiated"
  | "escrow_held"
  | "released"
  | "refunded"
  | "failed";
export type PaymentMethod = "airtel_money" | "tnm_mpamba" | "visa" | "mastercard" | "bank_transfer";
export type BookingPaymentStatus =
  | "unpaid"
  | "held_in_escrow"
  | "released"
  | "refunded";
export type WalletTxType = "credit" | "withdrawal";
export type CodeAuditResult =
  | "success"
  | "mismatch"
  | "expired"
  | "already_used";

export interface JwtPayload {
  sub: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
