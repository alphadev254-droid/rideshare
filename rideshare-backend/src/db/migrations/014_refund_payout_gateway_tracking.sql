ALTER TABLE payment_refunds
  ADD COLUMN IF NOT EXISTS payment_method payment_method,
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS gateway_charge_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gateway_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS payment_refunds_gateway_charge_id_idx ON payment_refunds(gateway_charge_id);
CREATE INDEX IF NOT EXISTS payment_refunds_provider_reference_idx ON payment_refunds(provider_reference);
