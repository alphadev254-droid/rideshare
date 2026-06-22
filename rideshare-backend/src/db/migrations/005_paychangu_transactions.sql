ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'visa';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'mastercard';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'bank_transfer';

CREATE TABLE IF NOT EXISTS pending_payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               UUID UNIQUE REFERENCES bookings(id),
  trip_id                  UUID REFERENCES trips(id),
  passenger_id             UUID NOT NULL REFERENCES users(id),
  driver_id                UUID NOT NULL REFERENCES driver_profiles(id),
  tx_ref                   VARCHAR(255) UNIQUE NOT NULL,
  provider                 VARCHAR(50) NOT NULL DEFAULT 'paychangu',
  payment_method           payment_method NOT NULL,
  boarding_point           VARCHAR(255),
  drop_off_point           VARCHAR(255),
  fare_amount_mwk          BIGINT NOT NULL,
  provider_fee_mwk         BIGINT NOT NULL,
  provider_fee_rate        NUMERIC(8,4) NOT NULL,
  system_fee_mwk           BIGINT NOT NULL,
  system_fee_rate          NUMERIC(8,4) NOT NULL,
  customer_amount_mwk      BIGINT NOT NULL,
  driver_amount_mwk        BIGINT NOT NULL,
  currency                 VARCHAR(8) NOT NULL DEFAULT 'MWK',
  status                   VARCHAR(30) NOT NULL DEFAULT 'pending',
  checkout_url             TEXT,
  gateway_reference        VARCHAR(255),
  provider_payload         JSONB,
  failure_reason           TEXT,
  verified_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_payments_booking_id ON pending_payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_passenger_id ON pending_payments (passenger_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_driver_id ON pending_payments (driver_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_tx_ref ON pending_payments (tx_ref);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS fare_amount_mwk BIGINT,
  ADD COLUMN IF NOT EXISTS provider_fee_mwk BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_fee_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS system_fee_mwk BIGINT,
  ADD COLUMN IF NOT EXISTS system_fee_rate NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS customer_amount_mwk BIGINT,
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'paychangu',
  ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_payload JSONB,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

UPDATE payments
SET fare_amount_mwk = COALESCE(fare_amount_mwk, gross_amount_mwk),
    system_fee_mwk = COALESCE(system_fee_mwk, commission_mwk),
    system_fee_rate = COALESCE(system_fee_rate, commission_rate),
    customer_amount_mwk = COALESCE(customer_amount_mwk, gross_amount_mwk)
WHERE fare_amount_mwk IS NULL
   OR system_fee_mwk IS NULL
   OR system_fee_rate IS NULL
   OR customer_amount_mwk IS NULL;

ALTER TABLE payments
  ALTER COLUMN fare_amount_mwk SET NOT NULL,
  ALTER COLUMN system_fee_mwk SET NOT NULL,
  ALTER COLUMN system_fee_rate SET NOT NULL,
  ALTER COLUMN customer_amount_mwk SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_ref ON payments (gateway_ref);
