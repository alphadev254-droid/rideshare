ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS segment_id UUID;

ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS segment_id UUID;

CREATE TABLE IF NOT EXISTS trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_order SMALLINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  pickup_point VARCHAR(255),
  drop_off_point VARCHAR(255),
  arrival_offset_minutes SMALLINT,
  departure_offset_minutes SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trip_stops_trip_order_unique UNIQUE (trip_id, stop_order)
);

CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id ON trip_stops (trip_id);

CREATE TABLE IF NOT EXISTS trip_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_stop_id UUID NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
  to_stop_id UUID NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
  from_order SMALLINT NOT NULL,
  to_order SMALLINT NOT NULL,
  fare_mwk BIGINT NOT NULL,
  max_seats SMALLINT NOT NULL DEFAULT 1,
  distance_km DECIMAL(8, 2),
  estimated_duration_minutes INTEGER,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trip_segments_trip_orders_unique UNIQUE (trip_id, from_order, to_order),
  CONSTRAINT trip_segments_forward_order CHECK (from_order < to_order)
);

CREATE INDEX IF NOT EXISTS idx_trip_segments_trip_enabled ON trip_segments (trip_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_trip_segments_from_stop ON trip_segments (from_stop_id);
CREATE INDEX IF NOT EXISTS idx_trip_segments_to_stop ON trip_segments (to_stop_id);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_segment_id_fkey
  FOREIGN KEY (segment_id) REFERENCES trip_segments(id)
  ON DELETE SET NULL;

ALTER TABLE pending_payments
  ADD CONSTRAINT pending_payments_segment_id_fkey
  FOREIGN KEY (segment_id) REFERENCES trip_segments(id)
  ON DELETE SET NULL;

INSERT INTO trip_stops (trip_id, stop_order, name, pickup_point, departure_offset_minutes)
SELECT t.id, 0, t.origin_name, t.pickup_point, 0
FROM trips t
WHERE NOT EXISTS (
  SELECT 1 FROM trip_stops s WHERE s.trip_id = t.id AND s.stop_order = 0
);

INSERT INTO trip_stops (trip_id, stop_order, name, drop_off_point, arrival_offset_minutes)
SELECT t.id, 1, t.destination_name, t.drop_off_point, t.estimated_duration_minutes
FROM trips t
WHERE NOT EXISTS (
  SELECT 1 FROM trip_stops s WHERE s.trip_id = t.id AND s.stop_order = 1
);

INSERT INTO trip_segments (
  trip_id,
  from_stop_id,
  to_stop_id,
  from_order,
  to_order,
  fare_mwk,
  max_seats,
  distance_km,
  estimated_duration_minutes,
  is_enabled
)
SELECT
  t.id,
  s0.id,
  s1.id,
  0,
  1,
  COALESCE(t.base_fare_mwk, 0),
  t.total_seats,
  t.distance_km,
  t.estimated_duration_minutes,
  true
FROM trips t
JOIN trip_stops s0 ON s0.trip_id = t.id AND s0.stop_order = 0
JOIN trip_stops s1 ON s1.trip_id = t.id AND s1.stop_order = 1
WHERE COALESCE(t.base_fare_mwk, 0) > 0
ON CONFLICT (trip_id, from_order, to_order) DO NOTHING;

UPDATE bookings b
SET segment_id = s.id
FROM trip_segments s
WHERE b.segment_id IS NULL
  AND s.trip_id = b.trip_id
  AND s.from_order = 0
  AND s.to_order = 1;

UPDATE pending_payments p
SET segment_id = s.id
FROM trip_segments s
WHERE p.segment_id IS NULL
  AND p.trip_id IS NOT NULL
  AND s.trip_id = p.trip_id
  AND s.from_order = 0
  AND s.to_order = 1;
