-- VALCO Waste Management Platform — Phase 3 schema additions
-- Adds: route planning (routes + ordered stops linking to collections)

CREATE TYPE route_status AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  route_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. RT-2026-008
  name VARCHAR(150) NOT NULL,
  collector_id INTEGER REFERENCES users(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  scheduled_date DATE NOT NULL,
  estimated_distance_km NUMERIC(6,1),
  estimated_duration_min INTEGER,
  status route_status NOT NULL DEFAULT 'PLANNED',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE route_stops (
  id SERIAL PRIMARY KEY,
  route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  collection_id INTEGER REFERENCES collections(id),
  stop_order INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | COMPLETED | SKIPPED
  arrived_at TIMESTAMPTZ,
  -- offline-first support: collectors can complete a stop while offline; the
  -- client stamps a local timestamp and flips this true, then the sync
  -- endpoint reconciles it against the server record once back online.
  synced BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (route_id, stop_order)
);

CREATE INDEX idx_route_stops_route ON route_stops(route_id);
CREATE INDEX idx_routes_collector_date ON routes(collector_id, scheduled_date);
