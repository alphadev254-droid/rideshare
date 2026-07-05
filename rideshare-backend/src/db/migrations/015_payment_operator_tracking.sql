ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_channel VARCHAR(80),
  ADD COLUMN IF NOT EXISTS provider_operator_ref_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_operator_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS provider_mobile_number VARCHAR(30);

ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS provider_channel VARCHAR(80),
  ADD COLUMN IF NOT EXISTS provider_operator_ref_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_operator_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS provider_mobile_number VARCHAR(30);

ALTER TABLE payment_refunds
  ADD COLUMN IF NOT EXISTS provider_channel VARCHAR(80),
  ADD COLUMN IF NOT EXISTS provider_operator_ref_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_operator_name VARCHAR(120);

CREATE INDEX IF NOT EXISTS payments_provider_operator_ref_id_idx ON payments(provider_operator_ref_id);
CREATE INDEX IF NOT EXISTS pending_payments_provider_operator_ref_id_idx ON pending_payments(provider_operator_ref_id);
CREATE INDEX IF NOT EXISTS payment_refunds_provider_operator_ref_id_idx ON payment_refunds(provider_operator_ref_id);
