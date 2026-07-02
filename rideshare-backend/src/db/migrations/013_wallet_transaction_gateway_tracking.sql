ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS gateway_charge_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS provider_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_gateway_charge_id
  ON wallet_transactions(gateway_charge_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_provider_reference
  ON wallet_transactions(provider_reference);
