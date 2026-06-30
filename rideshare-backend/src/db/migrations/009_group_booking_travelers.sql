ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS seats_booked SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS seats_booked SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS traveler_names JSONB;

CREATE TABLE IF NOT EXISTS booking_travelers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  seat_order SMALLINT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_travelers_booking_order_unique UNIQUE (booking_id, seat_order)
);

CREATE INDEX IF NOT EXISTS idx_booking_travelers_booking_id ON booking_travelers (booking_id);