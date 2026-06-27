/**
 * Service layer — one object per API resource.
 * Components/queries should call these, never `fetch` directly.
 */
import { api } from "./client";
import type {
  AdminUser,
  AuthTokens,
  Booking,
  ComfortClass,
  DriverDashboardStats,
  DriverProfile,
  PaginatedResponse,
  Payment,
  PendingPayment,
  PaymentMethod,
  PaymentStatus,
  PaymentRefund,
  RefundPreview,
  Review,
  Trip,
  TripLocation,
  TripStatus,
  User,
  Vehicle,
  WalletBalance,
  WalletTransaction,
  WalletWithdrawal,
} from "./types";

function vehiclePayloadFormData(body: Omit<Vehicle, "id" | "driverId" | "reviewStatus" | "createdAt">, file?: File) {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) continue;
    form.append(key, String(value));
  }
  if (file) form.append("insuranceDocument", file);
  return form;
}

// ─── Locations ────────────────────────────────────────────────────
export const locationService = {
  districts: () => api.get<string[]>("/locations/districts", { auth: false }),
};

export const contactService = {
  send: (body: { name: string; email: string; subject: string; message: string }) =>
    api.post<{ sent: true; email: string }>("/contact", body, { auth: false }),
};
// ─── Auth ─────────────────────────────────────────────────────────
export const authService = {
  register: (body: {
    phone: string;
    email: string;
    fullName: string;
    password: string;
    role: "passenger" | "driver";
  }) => api.post<{ userId: string; message: string }>("/auth/register", body, { auth: false }),

  verifyOtp: (body: { phone: string; otp: string }) =>
    api.post<AuthTokens>("/auth/verify-otp", body, { auth: false }),

  login: (body: { identifier: string; password: string }) =>
    api.post<AuthTokens | { needsVerification: true; phone: string }>("/auth/login", body, {
      auth: false,
    }),

  forgotPassword: (body: { identifier: string }) =>
    api.post<{ message: string }>("/auth/forgot-password", body, { auth: false }),

  resetPassword: (body: { identifier: string; otp: string; password: string }) =>
    api.post<{ message: string }>("/auth/reset-password", body, { auth: false }),

  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string }>("/auth/refresh", { refreshToken }, { auth: false }),

  logout: () => api.post<{ message: string }>("/auth/logout"),
};

// ─── Users ────────────────────────────────────────────────────────
export const userService = {
  me: () => api.get<User>("/users/me"),
  updateMe: (
    body: Partial<Pick<User, "fullName" | "emergencyContactName" | "emergencyContactPhone">> & {
      fcmToken?: string;
    },
  ) => api.patch<User>("/users/me", body),
  uploadUserAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<{ url: string; profilePhotoUrl: string }>("/uploads/user-avatar", form, {
      auth: true,
    });
  },
};

// ─── Drivers ──────────────────────────────────────────────────────
export const driverService = {
  profile: () => api.get<DriverProfile>("/drivers/profile"),
  register: (body: { licenseNumber: string; licenseExpiry: string }) =>
    api.post<DriverProfile>("/drivers/profile", body),
  dashboard: () => api.get<DriverDashboardStats>("/drivers/dashboard"),
  vehicles: () => api.get<Vehicle[]>("/drivers/vehicles"),
  addVehicle: (body: Omit<Vehicle, "id" | "driverId" | "reviewStatus" | "createdAt">, insuranceDocument?: File) =>
    insuranceDocument
      ? api.upload<Vehicle>("/drivers/vehicles", vehiclePayloadFormData(body, insuranceDocument), { auth: true })
      : api.post<Vehicle>("/drivers/vehicles", body),
  updateVehicle: (
    id: string,
    body: Omit<Vehicle, "id" | "driverId" | "reviewStatus" | "createdAt">,
    insuranceDocument?: File,
  ) =>
    insuranceDocument
      ? api.patch<Vehicle>(`/drivers/vehicles/${id}`, vehiclePayloadFormData(body, insuranceDocument), {
          formData: true,
        })
      : api.patch<Vehicle>(`/drivers/vehicles/${id}`, body),
  uploadVehicleImage: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<Vehicle>(`/drivers/vehicles/${id}/images`, form, { auth: true });
  },
  uploadVehicleInsuranceDocument: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<{ url: string; vehicle: Vehicle }>(`/drivers/vehicles/${id}/insurance-document`, form, {
      auth: true,
    });
  },
  removeVehicleInsuranceDocument: (id: string) =>
    api.delete<Vehicle>(`/drivers/vehicles/${id}/insurance-document`),
  removeVehicleImage: (id: string, url: string) =>
    api.delete<Vehicle>(`/drivers/vehicles/${id}/images`, {
      body: { url },
    }),
  deleteVehicle: (id: string) => api.delete<{ id: string; deleted: true }>(`/drivers/vehicles/${id}`),
  earnings: () =>
    api.get<{ totalEarningsMwk: string; totalTrips: number; wallet: WalletBalance }>(
      "/drivers/me/earnings",
    ),
  uploadDocument: (file: File, type: "id_front" | "id_back" | "license_doc") => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    return api.upload<{
      url: string;
      idFrontUrl?: string;
      idBackUrl?: string;
      licenseDocUrl?: string;
    }>("/uploads/driver-document", form, { auth: true });
  },
  uploadProfilePhoto: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<{ url: string; profilePhotoUrl: string }>("/uploads/profile-photo", form, {
      auth: true,
    });
  },
  requestReview: () =>
    api.post<{ id: string; reviewRequestedAt: string; isApproved: boolean }>(
      "/drivers/profile/request-review",
    ),
};

// ─── Trips ────────────────────────────────────────────────────────
export interface TripCreateBody {
  vehicleId: string;
  originName: string;
  pickupPoint?: string;
  originLat?: number;
  originLng?: number;
  destinationName: string;
  dropOffPoint?: string;
  destinationLat?: number;
  destinationLng?: number;
  departureTime: string;
  totalSeats: number;
  comfortClass: ComfortClass;
  distanceKm?: number;
  estimatedDurationMinutes: number;
  farePerSeatMwk: number;
}

export interface TripSearchQuery {
  originName?: string;
  destName?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  date: string;
  seats?: number;
  comfortClass?: ComfortClass;
  page?: number;
  limit?: number;
}

export const tripService = {
  create: (body: TripCreateBody) => api.post<Trip>("/trips", body),
  update: (id: string, body: TripCreateBody) => api.patch<Trip>(`/trips/${id}`, body),
  publicList: (query?: {
    page?: number;
    limit?: number;
    originName?: string;
    destName?: string;
    date?: string;
    seats?: number;
    comfortClass?: ComfortClass;
    driverId?: string;
  }) =>
    api.get<PaginatedResponse<Trip>>("/trips/public", {
      query: query as Record<string, string | number | boolean | undefined>,
      auth: false,
    }),
  search: (query: TripSearchQuery) => api.get<Trip[]>("/trips/search", { query: { ...query } }),
  mine: () => api.get<Trip[]>("/trips/mine"),
  byId: (id: string) => api.get<Trip>(`/trips/${id}`, { auth: false }),
  location: (id: string) => api.get<TripLocation>(`/trips/${id}/location`),
  setStatus: (id: string, status: Trip["status"]) =>
    api.patch<Trip>(`/trips/${id}/status`, { status }),
  start: (id: string) => api.patch<Trip>(`/trips/${id}/start`),
  cancel: (id: string) => api.patch<Trip>(`/trips/${id}/cancel`),
  updateLocation: (id: string, lat: number, lng: number) =>
    api.post<{ ok: true }>(`/trips/${id}/location`, { lat, lng }),
  authenticatePassenger: (id: string, bookingId: string, code: string) =>
    api.post<{ authenticated: boolean }>(`/trips/${id}/authenticate`, { bookingId, code }),
  complete: (id: string) => api.patch<Trip>(`/trips/${id}/complete`),
};

// ─── Bookings ─────────────────────────────────────────────────────
export const bookingService = {
  mine: () => api.get<Booking[]>("/bookings/mine"),
  admin: (query?: {
    page?: number;
    limit?: number;
    status?: Booking["status"] | "all";
    paymentStatus?: Booking["paymentStatus"] | "all";
    search?: string;
  }) =>
    api.get<{ data: Booking[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
      "/bookings/admin",
      { query: query as Record<string, string | number | boolean | undefined> },
    ),
  byTrip: (tripId: string) => api.get<Booking[]>(`/bookings/trip/${tripId}`),
  byId: (id: string) => api.get<Booking>(`/bookings/${id}`),
  refundPreview: (id: string) => api.get<RefundPreview>(`/bookings/${id}/refund-preview`),
  requestRefund: (id: string, body: { reason?: string }) =>
    api.post<PaymentRefund>(`/bookings/${id}/refund`, body),
  resendCode: (id: string) => api.post<{ message: string }>(`/bookings/${id}/resend-code`),
  verifyCode: (id: string, code: string) =>
    api.post<{ verified: boolean; bookingId: string }>(`/bookings/${id}/verify-code`, { code }),
  cancel: (id: string) => api.patch<Booking>(`/bookings/${id}/cancel`),
};

// ─── Payments ─────────────────────────────────────────────────────
const DEFAULT_CHECKOUT_PAYMENT_METHOD: PaymentMethod = "airtel_money";

export const paymentService = {
  initiate: (body: { bookingId: string; method?: PaymentMethod; phone: string }) =>
    api.post<PendingPayment & { paymentUrl: string; checkoutUrl: string }>(
      "/payments/initiate",
      { ...body, method: body.method ?? DEFAULT_CHECKOUT_PAYMENT_METHOD },
    ),
  initiateRide: (body: {
    tripId: string;
    boardingPoint: string;
    dropOffPoint?: string;
    method?: PaymentMethod;
    phone: string;
  }) =>
    api.post<PendingPayment & { paymentUrl: string; checkoutUrl: string }>(
      "/payments/initiate-ride",
      { ...body, method: body.method ?? DEFAULT_CHECKOUT_PAYMENT_METHOD },
    ),
  verify: (paymentId: string) =>
    api.get<{ state: string; transaction: Payment | PendingPayment | null }>(`/payments/verify/${paymentId}`),
  callback: (txRef: string) =>
    api.get<{ state: string; transaction: Payment | PendingPayment | null }>("/payments/callback/paychangu", {
      query: { tx_ref: txRef },
      auth: false,
    }),
  byBooking: (bookingId: string) => api.get<Payment | PendingPayment>(`/payments/${bookingId}`),
  myTransactions: (query?: { page?: number; limit?: number }) =>
    api.get<Payment[]>("/payments/transactions/my", {
      query: query as Record<string, string | number | boolean | undefined>,
    }),
  driverTransactions: (query?: { page?: number; limit?: number }) =>
    api.get<Payment[]>("/payments/transactions/driver", {
      query: query as Record<string, string | number | boolean | undefined>,
    }),
  adminTransactions: (query?: { page?: number; limit?: number; status?: PaymentStatus | "all"; search?: string }) =>
    api.get<Payment[]>("/payments/transactions/admin", {
      query: {
        ...query,
        status: query?.status === "all" ? undefined : query?.status,
      } as Record<string, string | number | boolean | undefined>,
    }),
  transactionById: (id: string) => api.get<Payment>(`/payments/transactions/${id}`),
};

// ─── Wallet ───────────────────────────────────────────────────────
export const walletService = {
  balance: () => api.get<WalletBalance>("/wallet/balance"),
  transactions: () => api.get<WalletTransaction[]>("/wallet/transactions"),
  withdrawals: () => api.get<WalletWithdrawal[]>("/wallet/withdrawals"),
  requestWithdrawalOtp: () =>
    api.post<{ sent: boolean; email: string; expiresAt: string; message: string }>("/wallet/withdraw/otp"),
  withdraw: (body: { amountMwk: number; phone: string; method: PaymentMethod; otp: string }) =>
    api.post<{ message: string; amountMwk: string; status: string; reference: string; id: string }>("/wallet/withdraw", body),
  withdrawalById: (id: string) =>
    api.get<WalletWithdrawal>(`/wallet/withdrawals/${id}`),
};

// ─── Reviews ──────────────────────────────────────────────────────
export const reviewService = {
  create: (body: { bookingId: string; rating: number; comment?: string }) =>
    api.post<Review>("/reviews", body),
  forDriver: (driverId: string) =>
    api.get<Review[]>(`/reviews/driver/${driverId}`, { auth: false }),
};

// ─── Admin ────────────────────────────────────────────────────────
// All admin endpoints require role=admin on the server.
export const adminService = {
  stats: () =>
    api.get<{
      totalUsers: number;
      totalDrivers: number;
      approvedDrivers: number;
      pendingReview: number;
      totalTrips: number;
      activeTrips: number;
      totalPayments: number;
    }>("/users/admin-stats"),
  // Users
  listUsers: (query?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: User["role"];
    active?: boolean;
    driverProfileStatus?: "no_profile" | "not_submitted" | "pending" | "approved";
  }) =>
    api.get<PaginatedResponse<AdminUser>>("/users", {
      query: query as Record<string, string | number | boolean | undefined>,
    }),
  getUser: (id: string) => api.get<AdminUser>(`/users/${id}`),
  updateUser: (
    id: string,
    body: Partial<
      Pick<
        AdminUser,
        | "fullName"
        | "phone"
        | "email"
        | "role"
        | "emergencyContactName"
        | "emergencyContactPhone"
        | "isActive"
      >
    >,
  ) => api.patch<AdminUser>(`/users/${id}`, body),
  setUserStatus: (id: string, isActive: boolean) =>
    api.patch<AdminUser>(`/users/${id}/status`, { isActive }),
  sendUserEmail: (id: string, body: { subject: string; message: string }) =>
    api.post<{ id: string; email: string; sent: true }>(`/users/${id}/email`, body),
  deleteUser: (id: string) => api.delete<{ id: string; deleted: true }>(`/users/${id}`),

  // Drivers
  listDrivers: (query?: { page?: number; limit?: number; approved?: boolean }) =>
    api.get<DriverProfile[]>("/drivers", {
      query: query as Record<string, string | number | boolean | undefined>,
    }),
  getDriver: (id: string) => api.get<DriverProfile & { vehicles?: Vehicle[] }>(`/drivers/${id}`),
  updateDriverProfile: (
    id: string,
    body: Partial<
      Pick<
        DriverProfile,
        | "licenseNumber"
        | "licenseExpiry"
        | "profilePhotoUrl"
        | "idFrontUrl"
        | "idBackUrl"
        | "licenseDocUrl"
        | "isApproved"
        | "reviewRequestedAt"
      >
    > & { approvalReason?: string; notificationMessage?: string },
  ) => api.patch<DriverProfile & { vehicles?: Vehicle[] }>(`/drivers/${id}`, body),
  uploadDriverProfilePhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<{ url: string; profile: DriverProfile & { vehicles?: Vehicle[] } }>(
      `/drivers/${id}/profile-photo`,
      form,
    );
  },
  uploadDriverDocument: (
    id: string,
    file: File,
    type: "id_front" | "id_back" | "license_doc",
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    return api.upload<{ url: string; profile: DriverProfile & { vehicles?: Vehicle[] } }>(
      `/drivers/${id}/document`,
      form,
    );
  },
  removeDriverProfileFile: (
    id: string,
    field: "profilePhotoUrl" | "idFrontUrl" | "idBackUrl" | "licenseDocUrl",
  ) => api.patch<DriverProfile & { vehicles?: Vehicle[] }>(`/drivers/${id}/file`, { field }),
  addDriverVehicle: (
    driverProfileId: string,
    body: Omit<Vehicle, "id" | "driverId" | "reviewStatus" | "createdAt" | "imageUrls" | "photoUrl">,
    insuranceDocument?: File,
  ) =>
    insuranceDocument
      ? api.upload<Vehicle>(
          `/drivers/${driverProfileId}/vehicles`,
          vehiclePayloadFormData(body, insuranceDocument),
        )
      : api.post<Vehicle>(`/drivers/${driverProfileId}/vehicles`, body),
  updateDriverVehicle: (
    driverProfileId: string,
    vehicleId: string,
    body: Omit<Vehicle, "id" | "driverId" | "reviewStatus" | "createdAt" | "imageUrls" | "photoUrl">,
    insuranceDocument?: File,
  ) =>
    insuranceDocument
      ? api.patch<Vehicle>(
          `/drivers/${driverProfileId}/vehicles/${vehicleId}`,
          vehiclePayloadFormData(body, insuranceDocument),
          { formData: true },
        )
      : api.patch<Vehicle>(`/drivers/${driverProfileId}/vehicles/${vehicleId}`, body),
  deleteDriverVehicle: (driverProfileId: string, vehicleId: string) =>
    api.delete<{ id: string; deleted: true }>(`/drivers/${driverProfileId}/vehicles/${vehicleId}`),
  uploadDriverVehicleImage: (driverProfileId: string, vehicleId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<Vehicle>(`/drivers/${driverProfileId}/vehicles/${vehicleId}/images`, form);
  },
  removeDriverVehicleImage: (driverProfileId: string, vehicleId: string, url: string) =>
    api.delete<Vehicle>(`/drivers/${driverProfileId}/vehicles/${vehicleId}/images`, {
      body: { url },
    }),
  uploadDriverVehicleInsuranceDocument: (driverProfileId: string, vehicleId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<{ url: string; vehicle: Vehicle }>(
      `/drivers/${driverProfileId}/vehicles/${vehicleId}/insurance-document`,
      form,
    );
  },
  removeDriverVehicleInsuranceDocument: (driverProfileId: string, vehicleId: string) =>
    api.delete<Vehicle>(`/drivers/${driverProfileId}/vehicles/${vehicleId}/insurance-document`),
  reviewDriverVehicle: (
    driverProfileId: string,
    vehicleId: string,
    reviewStatus: "approved" | "rejected" | "pending",
  ) => api.patch<Vehicle>(`/drivers/${driverProfileId}/vehicles/${vehicleId}/review`, { reviewStatus }),
  approveDriver: (id: string) =>
    api.patch<{ id: string; isApproved: boolean }>(`/drivers/${id}/approve`),

  // Trips
  listTrips: (query?: {
    page?: number;
    limit?: number;
    status?: TripStatus | "all";
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    api.get<Trip[]>("/trips", {
      query: {
        ...query,
        status: query?.status === "all" ? undefined : query?.status,
      } as Record<string, string | number | boolean | undefined>,
    }),
  createTrip: (body: TripCreateBody & { driverId: string }) =>
    api.post<Trip>("/trips/admin", body),
  updateTrip: (id: string, body: TripCreateBody & { driverId: string }) =>
    api.patch<Trip>(`/trips/admin/${id}`, body),
  setTripStatus: (id: string, status: TripStatus) =>
    api.patch<Trip>(`/trips/admin/${id}/status`, { status }),
  deleteTrip: (id: string) => api.delete<{ id: string; deleted: true }>(`/trips/admin/${id}`),

  // Payments
  listPayments: (query?: { page?: number; limit?: number; status?: PaymentStatus | "all"; search?: string }) =>
    paymentService.adminTransactions(query),
  getPayment: (id: string) => paymentService.transactionById(id),
  refundPayment: (paymentId: string) =>
    api.post<{ message: string; paymentId: string }>(`/payments/${paymentId}/refund`),
};
