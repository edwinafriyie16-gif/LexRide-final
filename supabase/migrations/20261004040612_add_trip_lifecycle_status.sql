ALTER TABLE public.lexride_trip_rooms
ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'Open'
CONSTRAINT lexride_trip_rooms_lifecycle_status_check
CHECK (lifecycle_status IN ('Open', 'Finished', 'Cancelled'));
