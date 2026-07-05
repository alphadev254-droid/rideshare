CREATE INDEX IF NOT EXISTS pending_payments_passenger_trip_status_idx
  ON pending_payments(passenger_id, trip_id, status);
