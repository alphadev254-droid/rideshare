ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INT;
