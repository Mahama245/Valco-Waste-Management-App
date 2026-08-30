import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate } from "../middleware/auth";

const router = Router();

// NOTE: current_lat/lng/speed are simulated (see seed_phase2.ts). There is no
// real GPS hardware connected. Swap the update mechanism in a device-gateway
// service later; this route/schema shape stays the same either way.
router.get("/", authenticate, async (_req, res) => {
  const result = await pool.query(
    `SELECT v.id, v.registration_number, v.vehicle_type, v.status, v.capacity_kg, v.fuel_type,
            v.mileage_km, v.insurance_expiry, v.roadworthy_expiry, v.maintenance_due,
            v.driver_id, u.full_name AS driver_name,
            v.current_lat, v.current_lng, v.speed_kmh, v.trip_distance_km, v.last_gps_update
     FROM vehicles v LEFT JOIN users u ON u.id = v.driver_id
     ORDER BY v.registration_number`
  );
  res.json({ vehicles: result.rows });
});

router.get("/alerts", authenticate, async (_req, res) => {
  const result = await pool.query(
    `SELECT id, registration_number, status,
       (maintenance_due <= CURRENT_DATE + interval '7 days') AS maintenance_due_soon,
       (insurance_expiry <= CURRENT_DATE + interval '30 days') AS insurance_expiring,
       (roadworthy_expiry <= CURRENT_DATE + interval '30 days') AS roadworthy_expiring,
       (last_gps_update < now() - interval '10 minutes') AS gps_stale
     FROM vehicles
     WHERE status = 'OFFLINE'
        OR maintenance_due <= CURRENT_DATE + interval '7 days'
        OR insurance_expiry <= CURRENT_DATE + interval '30 days'
        OR roadworthy_expiry <= CURRENT_DATE + interval '30 days'
        OR last_gps_update < now() - interval '10 minutes'`
  );
  res.json({ alerts: result.rows });
});

export default router;
