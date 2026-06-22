ALTER TABLE pending_payments
  ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id),
  ADD COLUMN IF NOT EXISTS boarding_point VARCHAR(255),
  ADD COLUMN IF NOT EXISTS drop_off_point VARCHAR(255),
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_pending_payments_trip_id ON pending_payments (trip_id);
