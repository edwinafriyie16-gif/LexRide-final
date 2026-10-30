-- Approximate start coordinates (rounded to 2 decimals, ~1 km) used only for
-- "people going your way" matching. Never returned by any API.
ALTER TABLE public.lexride_trip_rooms
  ADD COLUMN IF NOT EXISTS from_lat double precision,
  ADD COLUMN IF NOT EXISTS from_lng double precision;

CREATE INDEX IF NOT EXISTS lexride_trip_rooms_open_start_idx
  ON public.lexride_trip_rooms (from_lat, from_lng)
  WHERE lifecycle_status = 'Open';
