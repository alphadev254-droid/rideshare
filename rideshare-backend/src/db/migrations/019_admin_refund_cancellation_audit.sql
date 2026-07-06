ALTER TABLE payment_refunds
  ADD COLUMN IF NOT EXISTS requested_by_admin_id UUID,
  ADD COLUMN IF NOT EXISTS refund_destination_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refund_destination_override_reason TEXT;

CREATE INDEX IF NOT EXISTS payment_refunds_requested_by_admin_id_idx
  ON payment_refunds(requested_by_admin_id);
