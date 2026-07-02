ALTER TABLE wallet_withdrawal_requests
  ADD COLUMN IF NOT EXISTS gateway_charge_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS provider_payload JSONB,
  ADD COLUMN IF NOT EXISTS gateway_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_wallet_withdrawal_gateway_charge_id
  ON wallet_withdrawal_requests(gateway_charge_id);

CREATE INDEX IF NOT EXISTS idx_wallet_withdrawal_provider_reference
  ON wallet_withdrawal_requests(provider_reference);
