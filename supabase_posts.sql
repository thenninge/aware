CREATE TABLE IF NOT EXISTS posts (
  id serial PRIMARY KEY,
  name text,
  current_lat double precision,
  current_lng double precision,
  target_lat double precision,
  target_lng double precision,
  category text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc', now())
);
