ALTER TABLE trip_segments
  ADD COLUMN IF NOT EXISTS max_seats SMALLINT;

UPDATE trip_segments s
SET max_seats = t.total_seats
FROM trips t
WHERE s.trip_id = t.id
  AND s.max_seats IS NULL;

ALTER TABLE trip_segments
  ALTER COLUMN max_seats SET NOT NULL;

ALTER TABLE trip_segments
  ADD CONSTRAINT trip_segments_max_seats_positive CHECK (max_seats > 0);
