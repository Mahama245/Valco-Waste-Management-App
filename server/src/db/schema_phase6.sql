-- VALCO Waste Management Platform — Phase 6 schema additions
-- Adds: zone -> collector assignment (which collector is operationally
-- responsible for a zone's residents/collections).
--
-- Safe to run against the existing Neon database: additive only,
-- no data is dropped or altered.

ALTER TABLE zones ADD COLUMN IF NOT EXISTS collector_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_zones_collector ON zones(collector_id);
