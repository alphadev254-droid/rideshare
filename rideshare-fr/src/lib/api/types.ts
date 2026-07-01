// Enum types pulled directly from the API docs.
export type UserRole = "passenger" | "driver" | "admin";
export type TripStatus = "scheduled" | "boarding" | "in_transit" | "completed" | "cancelled";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "authenticated"
  | "completed"
  | "cancelled"
  | "no_show";
export type ComfortClass = "economy" | "standard" | "comfort";
export type InsuranceCategory = "third_party" | "comprehensive";
export type PaymentStatus = "initiated" | "escrow_held" | "released" | "refunded" | "failed";
export type PaymentMethod = "airtel_money" | "tnm_mpamba" | "visa" | "mastercard" | "bank_transfer";
export type BookingPaymentStatus = "unpaid" | "held_in_escrow" | "released" | "refunded";
export type WalletTxType = "credit" | "withdrawal";
export type WalletTxKind =
  | "trip_payout_credit"
  | "refund_convenience_credit"
  | "withdrawal_debit"
  | "admin_adjustment_credit"
  | "admin_adjustment_debit";
export type RefundStatus = "requested" | "processing" | "completed" | "failed" | "rejected";

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  fullName: string;
  role: UserRole;
  profilePhotoUrl?: string | null;
  rating?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type ReviewStatus = "pending" | "approved" | "rejected";
export type VehicleReviewStatus = "pending" | "approved" | "rejected" | "deleted";

export interface DriverProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  licenseExpiry: string;
  licenseDocUrl?: string | null;
  idFrontUrl?: string | null;
  idBackUrl?: string | null;
  profilePhotoUrl?: string | null;
  isApproved: boolean;
  reviewStatus: ReviewStatus;
  reviewRequestedAt?: string | null;
  totalTrips: number;
  totalEarningsMwk: string;
  rating?: string | null;
  createdAt: string;
  user?: Pick<User, "id" | "fullName" | "phone" | "profilePhotoUrl">;
  vehicles?: Vehicle[];
}

export interface AdminUser extends User {
  updatedAt?: string;
  driverProfile?: (DriverProfile & { vehicles?: Vehicle[] }) | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DriverDashboardStats {
  totalTrips: number;
  totalEarningsMwk: string;
  balanceMwk: string;
  rating: string;
  pendingTrips: number;
}

export interface Vehicle {
  id: string;
  driverId: string;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  cofNumber?: string | null;
  cofExpiry?: string | null;
  insuranceCategory?: InsuranceCategory | null;
  insuranceExpiry?: string | null;
  insuranceDocUrl?: string | null;
  color?: string | null;
  comfortClass: ComfortClass;
  seatCapacity: number;
  reviewStatus: VehicleReviewStatus;
  photoUrl?: string | null;
  imageUrls?: string[];
  createdAt: string;
}

export interface Trip {
  id: string;
  segmentId?: string | null;
  segmentFromOrder?: number;
  segmentToOrder?: number;
  driverId?: string;
  vehicleId?: string;
  status: TripStatus;
  originName: string;
  pickupPoint?: string | null;
  destinationName: string;
  dropOffPoint?: string | null;
  parentOriginName?: string;
  parentDestinationName?: string;
  arrivalTime?: string | null;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  farePerSeatMwk: string;
  comfortClass: ComfortClass;
  distanceKm: number;
  estimatedDurationMinutes?: number | null;
  routeStops?: Array<{
    name: string;
    stopOrder: number;
    arrivalOffsetMinutes?: number | null;
    departureOffsetMinutes?: number | null;
  }>;
  routeSegments?: Array<{
    id: string;
    fromOrder: number;
    toOrder: number;
    farePerSeatMwk: string;
    maxSeats: number;
    distanceKm?: number | null;
    estimatedDurationMinutes?: number | null;
    fromStop: {
      name: string;
      stopOrder: number;
      arrivalOffsetMinutes?: number | null;
      departureOffsetMinutes?: number | null;
    };
    toStop: {
      name: string;
      stopOrder: number;
      arrivalOffsetMinutes?: number | null;
      departureOffsetMinutes?: number | null;
    };
  }>;
  gpsTrackingActive?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  driver?: {
    id: string;
    rating?: string | null;
    user: Pick<User, "fullName" | "profilePhotoUrl" | "rating" | "phone">;
  };
  vehicle?: Pick<
    Vehicle,
    "make" | "model" | "plateNumber" | "year" | "color" | "imageUrls" | "seatCapacity"
  >;
  bookingCount?: number;
  _count?: { bookings?: number };
}

export interface TripStopInput {
  name: string;
  pickupPoint?: string;
  dropOffPoint?: string;
  arrivalOffsetMinutes?: number;
  departureOffsetMinutes?: number;
}

export interface TripSegmentInput {
  fromStopIndex: number;
  toStopIndex: number;
  farePerSeatMwk: number;
  maxSeats?: number;
  distanceKm?: number;
  estimatedDurationMinutes?: number;
  isEnabled?: boolean;
}

export interface TripLocation {
  tripId: string;
  status: TripStatus;
  gpsTrackingActive: boolean;
  lat: number | null;
  lng: number | null;
  address?: string | null;
  areaName?: string | null;
  addressUpdatedAt?: string | null;
  updatedAt: string;
}

export interface BookingTraveler {
  id: string;
  fullName: string;
  phone?: string | null;
  seatOrder: number;
  isPrimary: boolean;
}

export interface Booking {
  id: string;
  tripId: string;
  segmentId?: string | null;
  passengerId: string;
  seatsBooked: number;
  travelers?: BookingTraveler[];
  segment?: {
    id: string;
    fareMwk?: string;
    fromOrder?: number;
    toOrder?: number;
    fromStop?: { name: string; pickupPoint?: string | null; departureOffsetMinutes?: number | null };
    toStop?: { name: string; dropOffPoint?: string | null; arrivalOffsetMinutes?: number | null };
  } | null;
  boardingPoint: string;
  dropOffPoint?: string;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  fareMwk: string;
  codeAvailable?: boolean;
  boardingCode?: string | null;
  codeUsed?: boolean;
  ratedDriver?: boolean;
  secretCode?: string | null;
  createdAt: string;
  passenger?: {
    id?: string;
    fullName: string;
    phone: string;
    email?: string | null;
    rating?: string | null;
  };
  trip?: {
    id: string;
    originName: string;
    destinationName: string;
    departureTime: string;
    baseFareMwk: string;
    status: TripStatus;
    driver?: {
      id: string;
      userId: string;
      user: { id: string; fullName: string; phone: string; email?: string | null };
    };
    vehicle?: {
      id: string;
      make: string;
      model: string;
      plateNumber: string;
      color?: string | null;
      comfortClass: ComfortClass;
    };
  };
  payment?: {
    id: string;
    status: PaymentStatus;
    gatewayRef?: string | null;
    customerAmountMwk: string;
    netAmountMwk: string;
    createdAt: string;
  } | null;
}

export interface Payment {
  id: string;
  bookingId?: string;
  passengerId?: string;
  driverId?: string;
  paymentMethod: PaymentMethod;
  fareAmountMwk: string;
  providerFeeMwk?: string;
  providerFeeRate?: string;
  systemFeeMwk?: string;
  systemFeeRate?: string;
  customerAmountMwk: string;
  driverAmountMwk?: string;
  grossAmountMwk?: string;
  commissionMwk?: string;
  commissionRate?: string;
  netAmountMwk?: string;
  gatewayRef?: string | null;
  providerReference?: string | null;
  status: PaymentStatus;
  passengerName?: string | null;
  passengerPhone?: string | null;
  passengerEmail?: string | null;
  driverName?: string | null;
  route?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  departureTime?: string | null;
  escrowHeldAt?: string | null;
  releasedAt?: string | null;
  refundedAt?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface PendingPayment {
  id: string;
  bookingId?: string | null;
  tripId?: string | null;
  segmentId?: string | null;
  passengerId: string;
  seatsBooked: number;
  travelerNames?: string[];
  travelers?: BookingTraveler[];
  driverId: string;
  txRef: string;
  paymentMethod: PaymentMethod;
  fareAmountMwk: string;
  providerFeeMwk: string;
  providerFeeRate: string;
  systemFeeMwk: string;
  systemFeeRate: string;
  customerAmountMwk: string;
  driverAmountMwk: string;
  status: string;
  checkoutUrl?: string | null;
  paymentUrl?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

export interface WalletBalance {
  balanceMwk: string;
  totalEarnedMwk: string;
}

export interface WalletTransaction {
  id: string;
  type: WalletTxType;
  kind?: WalletTxKind | null;
  amountMwk: string;
  balanceBeforeMwk?: string | null;
  balanceAfterMwk?: string | null;
  bookingId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
  description: string;
  createdAt: string;
}

export interface WalletWithdrawal {
  id: string;
  amountMwk: string;
  phone: string;
  provider: string;
  status: "queued" | "processing" | "completed" | "failed";
  reference: string;
  failureReason?: string | null;
  createdAt: string;
  processedAt?: string | null;
  walletTransactionId?: string | null;
  balanceBeforeMwk?: string | null;
  balanceAfterMwk?: string | null;
}

export interface RefundPreview {
  bookingId: string;
  paymentId: string;
  fareAmountMwk: string;
  providerFeeMwk: string;
  originalCustomerAmountMwk: string;
  refundableBaseMwk: string;
  convenienceFeeRate: string;
  convenienceFeeMwk: string;
  driverConvenienceShareRate: string;
  driverConvenienceShareMwk: string;
  platformConvenienceFeeMwk: string;
  refundAmountMwk: string;
  policy: string;
}

export interface PaymentRefund extends Omit<RefundPreview, "fareAmountMwk" | "providerFeeMwk" | "policy"> {
  id: string;
  status: RefundStatus;
  reason?: string | null;
  requestedAt: string;
  processedAt?: string | null;
}

export interface Review {
  id: string;
  bookingId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}
