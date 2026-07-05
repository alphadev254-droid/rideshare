DROP INDEX IF EXISTS payment_refunds_payment_id_key;
CREATE INDEX IF NOT EXISTS payment_refunds_payment_id_idx ON payment_refunds(payment_id);
