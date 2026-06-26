-- Migration 008: Auto-approve vehicles on upload
-- Drivers no longer need admin review to use their vehicles.
-- Existing pending vehicles are promoted to approved.

ALTER TABLE vehicles
  ALTER COLUMN review_status SET DEFAULT 'approved';

UPDATE vehicles
  SET review_status = 'approved'
  WHERE review_status = 'pending';
