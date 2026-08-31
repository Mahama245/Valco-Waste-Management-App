-- VALCO Waste Management Platform — Phase 5 schema additions
-- Adds: QR-code-linked route stops, resident collection confirmations/ratings,
-- and self-registration support for residents.

-- Link a route stop to a specific bin so the collector's QR scan can be
-- verified against the bin actually assigned to that stop.
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS bin_id INTEGER REFERENCES bins(id);
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS scanned_code VARCHAR(60);
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS scan_verified BOOLEAN NOT NULL DEFAULT false;

-- Residents can confirm/rate that a collection actually happened at their location.
CREATE TABLE collection_confirmations (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(id),
  resident_id INTEGER NOT NULL REFERENCES users(id),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, resident_id)
);

CREATE INDEX idx_collection_confirmations_collection ON collection_confirmations(collection_id);
CREATE INDEX idx_route_stops_bin ON route_stops(bin_id);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO CURRENT_USER;
