-- Fixes the COUNT(*)+1 race condition in identifier generation
-- (WM-2026-xxxxxx, INC-2026-xxxxx, CMP-2026-xxxxx, RT-2026-xxx, WM-BIN-xxxxx).
-- Under concurrent requests, two users creating a collection at the same
-- moment could both read the same COUNT(*) and get the same ID. A
-- database-level atomic counter closes that gap.

CREATE TABLE id_counters (
  counter_key VARCHAR(40) PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 1
);

-- Seed each counter to continue from whatever's already been generated,
-- so existing identifiers are never reused or duplicated.
INSERT INTO id_counters (counter_key, next_value)
SELECT 'collection', COALESCE(MAX(id), 0) + 1 FROM collections
UNION ALL
SELECT 'incident', COALESCE(MAX(id), 0) + 1 FROM incidents
UNION ALL
SELECT 'complaint', COALESCE(MAX(id), 0) + 1 FROM complaints
UNION ALL
SELECT 'route', COALESCE(MAX(id), 0) + 1 FROM routes
UNION ALL
SELECT 'bin', COALESCE(MAX(id), 0) + 1 FROM bins
UNION ALL
SELECT 'zone', COALESCE(MAX(id), 0) + 1 FROM zones
ON CONFLICT (counter_key) DO NOTHING;
