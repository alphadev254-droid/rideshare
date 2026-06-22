ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;
