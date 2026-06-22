-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ───────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('passenger', 'driver', 'admin');
CREATE TYPE comfort_class AS ENUM ('economy', 'standard', 'comfort');
CREATE TYPE trip_status AS ENUM ('scheduled', 'boarding', 'in_transit', 'completed', 'cancelled');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'authenticated', 'completed', 'cancelled', 'no_show');
CREATE TYPE payment_status AS ENUM ('initiated', 'escrow_held', 'released', 'refunded', 'failed');
CREATE TYPE payment_method AS ENUM ('airtel_money', 'tnm_mpamba', 'bank_card');
CREATE TYPE booking_payment_status AS ENUM ('unpaid', 'held_in_escrow', 'released', 'refunded');
CREATE TYPE wallet_tx_type AS ENUM ('credit', 'withdrawal');
CREATE TYPE code_audit_result AS ENUM ('success', 'mismatch', 'expired', 'already_used');

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                   VARCHAR(20)  UNIQUE NOT NULL,
  email                   VARCHAR(255) UNIQUE,
  full_name               VARCHAR(255) NOT NULL,
  password_hash           TEXT         NOT NULL,
  role                    user_role    NOT NULL DEFAULT 'passenger',
  profile_photo_url       TEXT,
  id_verified             BOOLEAN      NOT NULL DEFAULT false,
  is_verified             BOOLEAN      NOT NULL DEFAULT false,
  rating                  NUMERIC(3,2),
  emergency_contact_name  VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  is_active               BOOLEAN      NOT NULL DEFAULT true,
  fcm_token               TEXT,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── DRIVER PROFILES ─────────────────────────────────────────────────────────
CREATE TABLE driver_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_number      VARCHAR(50)  UNIQUE NOT NULL,
  license_expiry      DATE         NOT NULL,
  license_doc_url     TEXT,
  is_approved         BOOLEAN      NOT NULL DEFAULT false,
  total_trips         INT          NOT NULL DEFAULT 0,
  total_earnings_mwk  BIGINT       NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);

-- ─── VEHICLES ────────────────────────────────────────────────────────────────
CREATE TABLE vehicles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      UUID         NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  make           VARCHAR(100) NOT NULL,
  model          VARCHAR(100) NOT NULL,
  year           SMALLINT     NOT NULL,
  plate_number   VARCHAR(20)  UNIQUE NOT NULL,
  comfort_class  comfort_class NOT NULL DEFAULT 'economy',
  seat_capacity  SMALLINT     NOT NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  photo_url      TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);

CREATE TABLE vehicle_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicle_images_vehicle_id ON vehicle_images(vehicle_id);

-- ─── TRIPS ───────────────────────────────────────────────────────────────────
CREATE TABLE trips (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id             UUID          NOT NULL REFERENCES driver_profiles(id),
  vehicle_id            UUID          NOT NULL REFERENCES vehicles(id),
  origin_name           VARCHAR(255)  NOT NULL,
  origin_point          GEOMETRY(Point, 4326) NOT NULL,
  destination_name      VARCHAR(255)  NOT NULL,
  destination_point     GEOMETRY(Point, 4326) NOT NULL,
  route_polyline        TEXT,
  departure_time        TIMESTAMPTZ   NOT NULL,
  available_seats       SMALLINT      NOT NULL,
  total_seats           SMALLINT      NOT NULL,
  comfort_class         comfort_class NOT NULL,
  status                trip_status   NOT NULL DEFAULT 'scheduled',
  distance_km           NUMERIC(8,2),
  base_fare_mwk         BIGINT,
  estimated_duration_minutes INT,
  gps_tracking_active   BOOLEAN       NOT NULL DEFAULT false,
  current_location      GEOMETRY(Point, 4326),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_trips_origin_point   ON trips USING GIST (origin_point);
CREATE INDEX idx_trips_dest_point     ON trips USING GIST (destination_point);
CREATE INDEX idx_trips_departure_time ON trips (departure_time);
CREATE INDEX idx_trips_status         ON trips (status);
CREATE INDEX idx_trips_driver_id      ON trips (driver_id);

-- ─── BOOKINGS ────────────────────────────────────────────────────────────────
CREATE TABLE bookings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                    UUID                   NOT NULL REFERENCES trips(id),
  passenger_id               UUID                   NOT NULL REFERENCES users(id),
  seats_booked               SMALLINT               NOT NULL DEFAULT 1,
  boarding_point             VARCHAR(255)           NOT NULL,
  boarding_point_geo         GEOMETRY(Point, 4326),
  drop_off_point             VARCHAR(255),
  secret_code                CHAR(60)               NOT NULL,
  code_used                  BOOLEAN                NOT NULL DEFAULT false,
  auth_attempt_count         SMALLINT               NOT NULL DEFAULT 0,
  status                     booking_status         NOT NULL DEFAULT 'pending',
  fare_mwk                   BIGINT                 NOT NULL,
  payment_status             booking_payment_status NOT NULL DEFAULT 'unpaid',
  emergency_contact_notified BOOLEAN                NOT NULL DEFAULT false,
  rated_driver               BOOLEAN                NOT NULL DEFAULT false,
  created_at                 TIMESTAMPTZ            NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ            NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookings_trip_id      ON bookings (trip_id);
CREATE INDEX idx_bookings_passenger_id ON bookings (passenger_id);

-- ─── SECRET CODE AUDIT LOG ───────────────────────────────────────────────────
CREATE TABLE secret_code_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID               NOT NULL REFERENCES bookings(id),
  driver_id   UUID               REFERENCES driver_profiles(id),
  entered_code VARCHAR(10)        NOT NULL,
  result      code_audit_result  NOT NULL,
  ip_address  INET,
  created_at  TIMESTAMPTZ        NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_booking_id ON secret_code_audit_log (booking_id);

-- ─── PAYMENTS ────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID           UNIQUE NOT NULL REFERENCES bookings(id),
  passenger_id      UUID           NOT NULL REFERENCES users(id),
  driver_id         UUID           NOT NULL REFERENCES driver_profiles(id),
  gross_amount_mwk  BIGINT         NOT NULL,
  commission_mwk    BIGINT         NOT NULL,
  commission_rate   NUMERIC(4,2)   NOT NULL,
  net_amount_mwk    BIGINT         NOT NULL,
  payment_method    payment_method NOT NULL,
  gateway_ref       VARCHAR(255),
  status            payment_status NOT NULL DEFAULT 'initiated',
  escrow_held_at    TIMESTAMPTZ,
  released_at       TIMESTAMPTZ,
  refunded_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_booking_id    ON payments (booking_id);
CREATE INDEX idx_payments_passenger_id  ON payments (passenger_id);
CREATE INDEX idx_payments_driver_id     ON payments (driver_id);

-- ─── DRIVER WALLET ───────────────────────────────────────────────────────────
CREATE TABLE driver_wallet (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID        UNIQUE NOT NULL REFERENCES driver_profiles(id),
  balance_mwk       BIGINT      NOT NULL DEFAULT 0,
  total_earned_mwk  BIGINT      NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── WALLET TRANSACTIONS ─────────────────────────────────────────────────────
CREATE TABLE wallet_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID             NOT NULL REFERENCES driver_profiles(id),
  type        wallet_tx_type   NOT NULL,
  amount_mwk  BIGINT           NOT NULL,
  booking_id  UUID             REFERENCES bookings(id),
  reference   TEXT,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_tx_driver_id ON wallet_transactions (driver_id);

-- ─── REVIEWS ─────────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID         UNIQUE NOT NULL REFERENCES bookings(id),
  passenger_id  UUID         NOT NULL REFERENCES users(id),
  driver_id     UUID         NOT NULL REFERENCES driver_profiles(id),
  rating        SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_driver_id ON reviews (driver_id);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
