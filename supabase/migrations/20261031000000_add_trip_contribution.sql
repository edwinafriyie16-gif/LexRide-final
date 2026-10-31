-- Estimated fare per person (GHS) that the host enters when creating a trip.
ALTER TABLE public.lexride_trip_rooms
  ADD COLUMN IF NOT EXISTS contribution integer;

CREATE INDEX IF NOT EXISTS lexride_trip_rooms_open_schedule_idx
  ON public.lexride_trip_rooms (date, time)
  WHERE lifecycle_status = 'Open';
