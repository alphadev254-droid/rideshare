# RideShare Malawi — Backend API Documentation

**Base URL:** `http://localhost:5000/api/v1`  
**Auth:** Bearer token (JWT) via `Authorization: Bearer <accessToken>` header.  
All responses are `application/json` with the envelope:

```json
{ "success": true, "data": <payload> }
```

Errors return:

```json
{ "success": false, "message": "Human-readable error" }
```

---

## Table of Contents

1. [Auth](#1-auth)
2. [Users (current user)](#2-users)
3. [Drivers](#3-drivers)
4. [Trips](#4-trips)
5. [Bookings](#5-bookings)
6. [Payments](#6-payments)
7. [Wallet (driver)](#7-wallet)
8. [Reviews](#8-reviews)
9. [Enums reference](#9-enums-reference)
10. [Full user flows](#10-full-user-flows)

---

## 1. Auth

### POST `/auth/register`

Register a new user. Sends a 6-digit OTP to the phone number by SMS.

**Body:**

```json
{
  "phone": "+265991234567",
  "fullName": "Chimwemwe Banda",
  "password": "secret123",
  "role": "passenger" // "passenger" | "driver"
}
```

**Response `201`:**

```json
{
  "userId": "uuid",
  "message": "OTP sent to your phone"
}
```

---

### POST `/auth/verify-otp`

Verify the OTP received by SMS. Returns tokens + user on success.

**Body:**

```json
{
  "phone": "+265991234567",
  "otp": "481920"
}
```

**Response `200`:**

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "phone": "+265991234567",
    "fullName": "Chimwemwe Banda",
    "role": "passenger",
    "isVerified": true,
    "idVerified": false,
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

---

### POST `/auth/login`

Log in with phone + password (user must already be OTP-verified).

**Body:**

```json
{
  "phone": "+265991234567",
  "password": "secret123"
}
```

**Response `200`:** Same shape as `/auth/verify-otp`.

---

### POST `/auth/refresh`

Exchange a refresh token for a new access token.

**Body:**

```json
{ "refreshToken": "eyJ..." }
```

**Response `200`:**

```json
{ "accessToken": "eyJ..." }
```

---

### POST `/auth/logout` 🔒

Revoke the current refresh token.

**Headers:** `Authorization: Bearer <accessToken>`  
**Response `200`:** `{ "message": "Logged out" }`

---

## 2. Users

### GET `/users/me` 🔒

Get the currently authenticated user's profile.

**Response `200`:**

```json
{
  "id": "uuid",
  "phone": "+265991234567",
  "email": null,
  "fullName": "Chimwemwe Banda",
  "role": "passenger",
  "profilePhotoUrl": null,
  "idVerified": false,
  "isVerified": true,
  "rating": "4.80",
  "emergencyContactName": null,
  "emergencyContactPhone": null,
  "isActive": true,
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

---

### PATCH `/users/me` 🔒

Update the current user's profile fields.

**Body (all optional):**

```json
{
  "fullName": "Chimwemwe Phiri",
  "emergencyContactName": "Grace Banda",
  "emergencyContactPhone": "+265881234567",
  "fcmToken": "firebase-push-token"
}
```

**Response `200`:** Updated user object (same shape as GET /users/me).

---

### GET `/users/:id` 🔒 `admin`

Get any user by ID. Admin only.

---

### PATCH `/users/:id/status` 🔒 `admin`

Activate/deactivate a user account. Admin only.

**Body:**

```json
{ "isActive": false }
```

---

## 3. Drivers

### GET `/drivers/profile` 🔒 `driver`

Get the current driver's profile (includes driver approval status).

**Response `200`:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "licenseNumber": "MW-DL-123456",
  "licenseExpiry": "2028-06-30T00:00:00Z",
  "licenseDocUrl": null,
  "isApproved": true,
  "totalTrips": 47,
  "totalEarningsMwk": "850000",
  "createdAt": "2025-01-01T00:00:00Z",
  "user": {
    "id": "uuid",
    "fullName": "Joseph Mwale",
    "phone": "+265991234567",
    "rating": "4.90",
    "profilePhotoUrl": null
  }
}
```

---

### POST `/drivers/profile` 🔒

Register the current user as a driver (submits for approval). Same as `/drivers/register`.

**Body:**

```json
{
  "licenseNumber": "MW-DL-123456",
  "licenseExpiry": "2028-06-30"
}
```

**Response `201`:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "licenseNumber": "MW-DL-123456",
  "licenseExpiry": "2028-06-30T00:00:00Z",
  "isApproved": false
}
```

---

### POST `/drivers/register` 🔒

Alias for POST `/drivers/profile` (same body, same response).

---

### GET `/drivers/dashboard` 🔒 `driver`

Aggregated statistics for the driver's home screen.

**Response `200`:**

```json
{
  "totalTrips": 47,
  "totalEarningsMwk": "850000",
  "balanceMwk": "12500",
  "rating": "4.90",
  "pendingTrips": 2
}
```

---

### GET `/drivers/vehicles` 🔒

List the driver's active vehicles.

**Response `200`:** Array of vehicle objects:

```json
[
  {
    "id": "uuid",
    "driverId": "uuid",
    "make": "Toyota",
    "model": "HiAce",
    "year": 2019,
    "plateNumber": "MW-1234",
    "comfortClass": "economy",
    "seatCapacity": 14,
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

---

### POST `/drivers/vehicles` 🔒

Add a vehicle to the driver's profile.

**Body:**

```json
{
  "make": "Toyota",
  "model": "HiAce",
  "year": 2019,
  "plateNumber": "MW-1234",
  "comfortClass": "economy",
  "seatCapacity": 14
}
```

**Response `201`:** Vehicle object (same shape as above).

---

### GET `/drivers/me/earnings` 🔒

Get earnings summary for the current driver.

**Response `200`:**

```json
{
  "totalEarningsMwk": "850000",
  "totalTrips": 47,
  "wallet": {
    "balanceMwk": "12500",
    "totalEarnedMwk": "850000"
  }
}
```

---

### GET `/drivers` 🔒 `admin`

List all drivers (paginated). Admin only.

**Query:** `?page=1&limit=20&approved=true`

---

### PATCH `/drivers/:id/approve` 🔒 `admin`

Approve a driver by their driverProfile ID.

**Response `200`:** `{ "id": "uuid", "isApproved": true }`

---

## 4. Trips

### POST `/trips` 🔒 `driver`

Create a new trip.

**Body:**

```json
{
  "vehicleId": "uuid",
  "originName": "Lilongwe",
  "originLat": -13.9669,
  "originLng": 33.7873,
  "destinationName": "Blantyre",
  "destinationLat": -15.7861,
  "destinationLng": 35.0058,
  "departureTime": "2025-06-15T06:30:00Z",
  "totalSeats": 14,
  "comfortClass": "economy",
  "distanceKm": 340
}
```

> `originLat/Lng` and `destinationLat/Lng` are optional (default 0 if GPS not available).

**Response `201`:** Full trip object.

---

### GET `/trips/search` 🔒

Search available trips by route and date.

**Query parameters:**
| Param | Required | Example |
|---|---|---|
| `originLat` | ✅ | `-13.9669` |
| `originLng` | ✅ | `33.7873` |
| `destLat` | ✅ | `-15.7861` |
| `destLng` | ✅ | `35.0058` |
| `date` | ✅ | `2025-06-15` |
| `seats` | ❌ | `1` |
| `comfortClass` | ❌ | `economy` |
| `page` | ❌ | `1` |
| `limit` | ❌ | `20` |

**Response `200`:** Array of trip objects.

---

### GET `/trips/mine` 🔒 `driver`

List all trips belonging to the authenticated driver.

**Response `200`:** Array of trip objects with booking counts.

---

### GET `/trips/:id` 🔒

Get a single trip by ID with driver and vehicle details.

**Response `200`:**

```json
{
  "id": "uuid",
  "status": "scheduled",
  "originName": "Lilongwe",
  "destinationName": "Blantyre",
  "departureTime": "2025-06-15T06:30:00Z",
  "totalSeats": 14,
  "availableSeats": 10,
  "farePerSeatMwk": "5000",
  "comfortClass": "economy",
  "distanceKm": 340,
  "gpsTrackingActive": false,
  "startedAt": null,
  "completedAt": null,
  "driver": {
    "id": "uuid",
    "user": { "fullName": "Joseph Mwale", "rating": "4.90", "profilePhotoUrl": null }
  },
  "vehicle": {
    "make": "Toyota",
    "model": "HiAce",
    "plateNumber": "MW-1234",
    "year": 2019
  }
}
```

---

### PATCH `/trips/:id/status` 🔒 `driver`

Update trip status. Driver only; must own the trip.

**Body:**

```json
{ "status": "boarding" }
```

Valid transitions: `scheduled → boarding → in_transit → completed / cancelled`

---

### PATCH `/trips/:id/start` 🔒 `driver`

Shortcut to set status to `in_transit` (alias for PATCH status).

---

### PATCH `/trips/:id/cancel` 🔒 `driver`

Shortcut to set status to `cancelled`.

---

### PATCH `/trips/:id/location` 🔒 `driver`

Update the driver's current GPS position during a trip.

**Body:**

```json
{ "lat": -14.1234, "lng": 33.9876 }
```

---

### POST `/trips/:id/authenticate` 🔒 `driver`

Verify a passenger's secret boarding code.

**Body:**

```json
{
  "bookingId": "uuid",
  "code": "A1B2C3"
}
```

**Response `200`:** `{ "authenticated": true }`

---

### POST `/trips/:id/complete` 🔒 `driver`

Mark a trip as completed. Triggers payment release to driver wallet.

---

### GET `/trips` 🔒 `admin`

List all trips (paginated). Admin only.

---

## 5. Bookings

### POST `/bookings` 🔒

Create a booking for a trip.

**Body:**

```json
{
  "tripId": "uuid",
  "boardingPoint": "Area 18 roundabout",
  "boardingLat": -13.97,
  "boardingLng": 33.785,
  "dropOffPoint": "Blantyre CBD"
}
```

**Response `201`:**

```json
{
  "id": "uuid",
  "tripId": "uuid",
  "passengerId": "uuid",
  "boardingPoint": "Area 18 roundabout",
  "dropOffPoint": "Blantyre CBD",
  "status": "pending",
  "paymentStatus": "unpaid",
  "fareMwk": "5000",
  "secretCode": null,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

> The `secretCode` is only revealed after payment is confirmed (sent via SMS).

---

### GET `/bookings/mine` 🔒

List all bookings for the current passenger.

**Response `200`:** Array of booking objects.

---

### GET `/bookings/my` 🔒

Alias for `/bookings/mine`.

---

### GET `/bookings/trip/:tripId` 🔒 `driver`

List all bookings for a specific trip (driver must own that trip).

**Response `200`:** Array of booking objects with passenger info:

```json
[
  {
    "id": "uuid",
    "boardingPoint": "Area 18 roundabout",
    "status": "confirmed",
    "paymentStatus": "held_in_escrow",
    "fareMwk": "5000",
    "passenger": {
      "fullName": "Chimwemwe Banda",
      "phone": "+265991234567",
      "rating": "4.80"
    }
  }
]
```

---

### GET `/bookings/:id` 🔒

Get a single booking by ID.

---

### POST `/bookings/:id/resend-code`🔒

Resend the boarding secret code by SMS.

---

### POST `/bookings/:id/verify-code` 🔒 `driver`

Verify a passenger's boarding code (driver-facing). Sets booking status to `authenticated`.

**Body:**

```json
{ "code": "A1B2C3" }
```

**Response `200`:** `{ "verified": true, "bookingId": "uuid" }`

---

### PATCH `/bookings/:id/cancel` 🔒

Cancel a booking. Triggers refund if payment was in escrow.

---

### DELETE `/bookings/:id` 🔒

Alias for cancel booking.

---

## 6. Payments

### POST `/payments/initiate` 🔒

Initiate a Paychangu mobile-money payment for a booking.

**Body:**

```json
{
  "bookingId": "uuid",
  "method": "airtel_money",
  "phone": "+265991234567"
}
```

**Response `201`:**

```json
{
  "paymentId": "uuid",
  "checkoutUrl": "https://paychangu.com/pay/...",
  "status": "initiated"
}
```

---

### GET `/payments/verify/:paymentId` 🔒

Poll Paychangu to verify and update a payment's status.

**Response `200`:**

```json
{
  "status": "escrow_held",
  "bookingId": "uuid"
}
```

---

### GET `/payments/:bookingId` 🔒

Get payment status for a booking.

**Response `200`:**

```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "method": "airtel_money",
  "amountMwk": "5000",
  "status": "escrow_held",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

---

### POST `/payments/webhook/paychangu`

Paychangu webhook. Called by Paychangu server only. No auth header required.

---

### POST `/payments/:id/refund` 🔒 `admin`

Issue a manual refund. Admin only.

---

## 7. Wallet

All wallet routes require `driver` role.

### GET `/wallet/balance` 🔒 `driver`

Get the driver's current wallet balance.

**Response `200`:**

```json
{
  "balanceMwk": "12500",
  "totalEarnedMwk": "850000",
  "pendingMwk": "5000"
}
```

---

### GET `/wallet/transactions` 🔒 `driver`

List the driver's wallet transaction history.

**Response `200`:** Array:

```json
[
  {
    "id": "uuid",
    "type": "credit",
    "amountMwk": "5000",
    "description": "Trip payout",
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

---

### POST `/wallet/withdraw` 🔒 `driver`

Request a withdrawal to mobile money.

**Body:**

```json
{
  "amountMwk": 5000,
  "phone": "+265991234567",
  "method": "airtel_money"
}
```

**Response `200`:** `{ "message": "Withdrawal initiated", "amountMwk": 5000 }`

---

## 8. Reviews

### POST `/reviews` 🔒

Submit a rating/review for a completed trip.

**Body:**

```json
{
  "bookingId": "uuid",
  "rating": 5,
  "comment": "Very punctual and professional driver."
}
```

**Response `201`:** Review object.

---

### GET `/reviews/driver/:driverId`

Get all reviews for a driver (public, no auth required).

**Response `200`:** Array of review objects.

---

## 9. Enums Reference

| Enum                   | Values                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `UserRole`             | `passenger` \| `driver` \| `admin`                                                     |
| `TripStatus`           | `scheduled` \| `boarding` \| `in_transit` \| `completed` \| `cancelled`                |
| `BookingStatus`        | `pending` \| `confirmed` \| `authenticated` \| `completed` \| `cancelled` \| `no_show` |
| `ComfortClass`         | `economy` \| `standard` \| `comfort`                                                   |
| `PaymentStatus`        | `initiated` \| `escrow_held` \| `released` \| `refunded` \| `failed`                   |
| `PaymentMethod`        | `airtel_money` \| `tnm_mpamba` \| `visa` \| `mastercard` \| `bank_transfer`            |
| `BookingPaymentStatus` | `unpaid` \| `held_in_escrow` \| `released` \| `refunded`                               |
| `WalletTxType`         | `credit` \| `withdrawal`                                                               |

---

## 10. Full User Flows

### Passenger: Book a ride

```
1. POST /auth/register         → receive OTP by SMS
2. POST /auth/verify-otp       → get accessToken + refreshToken + user
3. GET  /trips/search?...      → browse available trips
4. POST /bookings              → create booking (status: pending, paymentStatus: unpaid)
5. POST /payments/initiate     → get Paychangu checkoutUrl, redirect user
6. GET  /payments/verify/:id   → poll until status = "escrow_held"
   (booking status becomes "confirmed", SMS with secret code sent)
7. On trip day: show code to driver at boarding point
8. POST /reviews               → rate the driver after arrival
```

---

### Driver: Create and run a trip

```
1. POST /auth/register (role: "driver")
2. POST /auth/verify-otp
3. POST /drivers/profile       → submit licence (status: awaiting approval)
   (admin approves via PATCH /drivers/:id/approve)
4. POST /drivers/vehicles      → add vehicle
5. POST /trips                 → publish trip
6. GET  /bookings/trip/:tripId → see all confirmed passengers before departure
7. PATCH /trips/:id/status     → set to "boarding"
8. POST /bookings/:id/verify-code  → verify each passenger's code at boarding
9. PATCH /trips/:id/start      → set to "in_transit" (GPS tracking begins)
10. PATCH /trips/:id/location  → stream GPS every N seconds
11. POST /trips/:id/complete   → mark complete (payment released to wallet)
12. GET  /wallet/balance        → check earnings
13. POST /wallet/withdraw       → withdraw to mobile money
```

---

### Auth token lifecycle

```
accessToken  → short-lived (15 min). Send in Authorization header on every request.
refreshToken → long-lived (30 days). Send to POST /auth/refresh to get new accessToken.
logout       → POST /auth/logout revokes refreshToken server-side.
```

---

## Frontend pages needed

| Page                 | Auth      | Description                          |
| -------------------- | --------- | ------------------------------------ |
| `/`                  | public    | Landing / marketing                  |
| `/how-it-works`      | public    | Explainer                            |
| `/safety`            | public    | Safety features                      |
| `/drivers`           | public    | Driver recruitment                   |
| `/about`             | public    | About page                           |
| `/contact`           | public    | Contact form                         |
| `/app`               | passenger | Trip search + booking dashboard      |
| `/app/search`        | passenger | Search results                       |
| `/app/trips/:id`     | passenger | Trip detail + book                   |
| `/app/bookings`      | passenger | My bookings list                     |
| `/app/bookings/:id`  | passenger | Booking detail + payment + code      |
| `/driver`            | driver    | Driver dashboard (stats)             |
| `/driver/trips`      | driver    | My trips list                        |
| `/driver/trips/new`  | driver    | Create trip form                     |
| `/driver/trips/:id`  | driver    | Trip management + passenger boarding |
| `/driver/onboarding` | driver    | Licence + vehicle submission         |
| `/driver/wallet`     | driver    | Balance + transactions + withdraw    |
| `/driver/profile`    | driver    | Edit profile                         |

> **Auth modal** (sign in / register / OTP verify) should be a global overlay modal triggered from any public page — not a separate route.
