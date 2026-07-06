ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reservation_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reservation_release_reason TEXT;

CREATE INDEX IF NOT EXISTS pending_payments_status_reservation_expires_at_idx
  ON pending_payments(status, reservation_expires_at);
