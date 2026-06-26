-- Migration 007: Add optional pickup_point to trips
-- Drivers can specify an exact boarding location distinct from the origin city name.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS pickup_point VARCHAR(255) NULL;
