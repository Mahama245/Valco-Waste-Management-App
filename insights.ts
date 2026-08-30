-- VALCO Waste Management Platform — Phase 2 schema additions
-- Adds: smart bins, vehicle GPS/fleet detail, incidents, complaints, notifications

CREATE TYPE bin_status AS ENUM ('NORMAL', 'NEAR_CAPACITY', 'CRITICAL', 'OUT_OF_SERVICE');
CREATE TYPE vehicle_status AS ENUM ('AVAILABLE', 'ASSIGNED', 'EN_ROUTE', 'COLLECTING', 'RETURNING', 'MAINTENANCE', 'OFFLINE');
CREATE TYPE incident_category AS ENUM (
  'OVERFLOWING_BIN', 'MISSED_COLLECTION', 'ILLEGAL_DUMPING', 'DAMAGED_BIN', 'HAZARDOUS_WASTE',
  'WASTE_SPILL', 'BLOCKED_ACCESS', 'VEHICLE_BREAKDOWN', 'WORKER_SAFETY', 'ENVIRONMENTAL', 'OTHER'
);
CREATE TYPE incident_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE incident_status AS ENUM ('NEW', 'ASSIGNED', 'INVESTIGATING', 'RESOLVED', 'CLOSED');
CREATE TYPE complaint_status AS ENUM ('SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- Extend vehicles table (created in Phase 1) with fleet-management detail
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS capacity_kg NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS mileage_km NUMERIC(10,1),
  ADD COLUMN IF NOT EXISTS insurance_expiry DATE,
  ADD COLUMN IF NOT EXISTS roadworthy_expiry DATE,
  ADD COLUMN IF NOT EXISTS maintenance_due DATE,
  ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS current_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS current_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS speed_kmh NUMERIC(5,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trip_distance_km NUMERIC(8,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_gps_update TIMESTAMPTZ;

ALTER TABLE vehicles ALTER COLUMN status TYPE vehicle_status USING status::vehicle_status;
ALTER TABLE vehicles ALTER COLUMN status SET DEFAULT 'AVAILABLE';

CREATE TABLE bins (
  id SERIAL PRIMARY KEY,
  bin_code VARCHAR(30) UNIQUE NOT NULL,  -- e.g. WM-BIN-00482
  zone_id INTEGER NOT NULL REFERENCES zones(id),
  location VARCHAR(200) NOT NULL,
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  waste_type waste_type NOT NULL DEFAULT 'GENERAL',
  capacity_liters NUMERIC(8,1) NOT NULL DEFAULT 1100,
  fill_level_pct NUMERIC(5,1) NOT NULL DEFAULT 0,
  status bin_status NOT NULL DEFAULT 'NORMAL',
  condition VARCHAR(30) NOT NULL DEFAULT 'GOOD',
  installed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  last_collected_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE incidents (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(30) UNIQUE NOT NULL, -- e.g. INC-2026-00481
  reporter_id INTEGER REFERENCES users(id),
  zone_id INTEGER REFERENCES zones(id),
  location VARCHAR(200) NOT NULL,
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  category incident_category NOT NULL,
  severity incident_severity NOT NULL DEFAULT 'MEDIUM',
  description TEXT NOT NULL,
  photo_note VARCHAR(200), -- placeholder reference; real file storage is a later integration
  assigned_officer_id INTEGER REFERENCES users(id),
  status incident_status NOT NULL DEFAULT 'NEW',
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE complaints (
  id SERIAL PRIMARY KEY,
  tracking_number VARCHAR(30) UNIQUE NOT NULL, -- e.g. CMP-2026-00312
  resident_id INTEGER NOT NULL REFERENCES users(id),
  category VARCHAR(50) NOT NULL, -- missed_collection | overflowing_bin | illegal_dumping | damaged_bin | other
  location VARCHAR(200),
  description TEXT NOT NULL,
  status complaint_status NOT NULL DEFAULT 'SUBMITTED',
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- missed_collection | bin_critical | incident_assigned | complaint_resolved | maintenance_due | ...
  title VARCHAR(150) NOT NULL,
  body TEXT,
  record_type VARCHAR(50),
  record_id INTEGER,
  is_read BOOLEAN NOT NULL DEFAULT false,
  -- These flags reflect the mock dispatch architecture described in the platform brief:
  -- no real email/SMS provider is connected yet, so both stay false until one is wired in.
  email_dispatched BOOLEAN NOT NULL DEFAULT false,
  sms_dispatched BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bins_zone ON bins(zone_id);
CREATE INDEX idx_bins_status ON bins(status);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_zone ON incidents(zone_id);
CREATE INDEX idx_complaints_resident ON complaints(resident_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
