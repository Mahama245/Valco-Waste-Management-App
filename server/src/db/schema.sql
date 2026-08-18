-- VALCO Waste Management Platform — Phase 1 schema
-- Covers: auth/roles, zones, collections, audit log.
-- Later phases add: bins, routes, vehicles, incidents, complaints, notifications, contractors.

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'ICT_ADMIN',
  'WASTE_MANAGER',
  'SUPERVISOR',
  'COLLECTOR',
  'DRIVER',
  'HSE_OFFICER',
  'CONTRACTOR',
  'RESIDENT',
  'MANAGEMENT'
);

CREATE TYPE collection_status AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'MISSED',
  'CANCELLED'
);

CREATE TYPE collection_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'EMERGENCY');

CREATE TYPE waste_type AS ENUM (
  'GENERAL', 'PLASTIC', 'PAPER', 'METAL', 'GLASS', 'ORGANIC', 'HAZARDOUS', 'E_WASTE', 'OTHER'
);

CREATE TABLE zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  department VARCHAR(100),
  zone_id INTEGER REFERENCES zones(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Minimal vehicle stub so collections can reference one; full fleet module comes in a later phase.
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  registration_number VARCHAR(30) UNIQUE NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE collections (
  id SERIAL PRIMARY KEY,
  collection_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. WM-2026-000124
  zone_id INTEGER NOT NULL REFERENCES zones(id),
  location VARCHAR(200) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time VARCHAR(20),
  collector_id INTEGER REFERENCES users(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  waste_type waste_type NOT NULL DEFAULT 'GENERAL',
  priority collection_priority NOT NULL DEFAULT 'NORMAL',
  status collection_status NOT NULL DEFAULT 'PENDING',
  actual_pickup_time TIMESTAMPTZ,
  quantity_collected_kg NUMERIC(10, 2),
  missed_reason TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,      -- e.g. CREATE, UPDATE, DELETE, LOGIN
  record_type VARCHAR(50) NOT NULL, -- e.g. 'collection', 'user'
  record_id INTEGER,
  description TEXT NOT NULL,        -- human-readable, e.g. "Supervisor changed collection WM-2026-000124 from Pending to Completed."
  previous_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collections_zone ON collections(zone_id);
CREATE INDEX idx_collections_status ON collections(status);
CREATE INDEX idx_collections_scheduled_date ON collections(scheduled_date);
CREATE INDEX idx_audit_logs_record ON audit_logs(record_type, record_id);
CREATE INDEX idx_users_role ON users(role);
