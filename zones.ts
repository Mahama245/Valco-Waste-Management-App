import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, authorize, AuthedRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";
import { nextRouteCode } from "../utils/identifiers";

const router = Router();
const MANAGE_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR"];

// List routes — collectors see only their own, staff see all (optionally filtered by date)
router.get("/", authenticate, async (req: AuthedRequest, res) => {
  const { date } = req.query;
  const clauses: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (req.user!.role === "COLLECTOR") {
    clauses.push(`r.collector_id = $${i++}`);
    values.push(req.user!.id);
  }
  if (date) {
    clauses.push(`r.scheduled_date = $${i++}`);
    values.push(date);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT r.id, r.route_code, r.name, r.collector_id, u.full_name AS collector_name,
            r.vehicle_id, v.registration_number AS vehicle_reg, r.scheduled_date,
            r.estimated_distance_km, r.estimated_duration_min, r.status, r.started_at, r.completed_at,
            (SELECT COUNT(*) FROM route_stops WHERE route_id = r.id)::int AS total_stops,
            (SELECT COUNT(*) FROM route_stops WHERE route_id = r.id AND status = 'COMPLETED')::int AS completed_stops
     FROM routes r
     LEFT JOIN users u ON u.id = r.collector_id
     LEFT JOIN vehicles v ON v.id = r.vehicle_id
     ${where}
     ORDER BY r.scheduled_date DESC, r.id`,
    values
  );
  res.json({ routes: result.rows });
});

// Full detail for one route including ordered stops with collection info
// Driver's view: their assigned vehicle + today's route on that vehicle, if any.
// Must be registered before GET /:id, or Express will try to parse
// "my-vehicle-today" as a numeric id and fail.
router.get("/my-vehicle-today", authenticate, async (req: AuthedRequest, res) => {
  const vehicle = await pool.query(
    `SELECT id, registration_number, vehicle_type, status, capacity_kg, fuel_type, mileage_km,
            insurance_expiry, roadworthy_expiry, maintenance_due, current_lat, current_lng,
            speed_kmh, trip_distance_km, last_gps_update
     FROM vehicles WHERE driver_id = $1 LIMIT 1`,
    [req.user!.id]
  );
  if (!vehicle.rows[0]) return res.json({ vehicle: null, route: null, stops: [] });

  const today = new Date().toISOString().slice(0, 10);
  const route = await pool.query(
    `SELECT r.*, u.full_name AS collector_name
     FROM routes r LEFT JOIN users u ON u.id = r.collector_id
     WHERE r.vehicle_id = $1 AND r.scheduled_date = $2 LIMIT 1`,
    [vehicle.rows[0].id, today]
  );

  let stops: any[] = [];
  if (route.rows[0]) {
    const stopsRes = await pool.query(
      `SELECT rs.id, rs.stop_order, rs.status, c.collection_code, c.location, c.waste_type, c.scheduled_time, z.name AS zone_name
       FROM route_stops rs
       LEFT JOIN collections c ON c.id = rs.collection_id
       LEFT JOIN zones z ON z.id = c.zone_id
       WHERE rs.route_id = $1 ORDER BY rs.stop_order`,
      [route.rows[0].id]
    );
    stops = stopsRes.rows;
  }

  res.json({ vehicle: vehicle.rows[0], route: route.rows[0] || null, stops });
});

router.get("/:id", authenticate, async (req: AuthedRequest, res) => {
  const routeRes = await pool.query(
    `SELECT r.*, u.full_name AS collector_name, v.registration_number AS vehicle_reg
     FROM routes r LEFT JOIN users u ON u.id = r.collector_id LEFT JOIN vehicles v ON v.id = r.vehicle_id
     WHERE r.id = $1`,
    [req.params.id]
  );
  if (!routeRes.rows[0]) return res.status(404).json({ error: "Route not found." });

  if (req.user!.role === "COLLECTOR" && routeRes.rows[0].collector_id !== req.user!.id) {
    return res.status(403).json({ error: "You can only view your own routes." });
  }

  const stopsRes = await pool.query(
    `SELECT rs.id, rs.stop_order, rs.status, rs.arrived_at, rs.synced,
            c.collection_code, c.location, c.waste_type, c.priority, c.scheduled_time, c.status AS collection_status,
            z.name AS zone_name
     FROM route_stops rs
     LEFT JOIN collections c ON c.id = rs.collection_id
     LEFT JOIN zones z ON z.id = c.zone_id
     WHERE rs.route_id = $1
     ORDER BY rs.stop_order`,
    [req.params.id]
  );

  res.json({ route: routeRes.rows[0], stops: stopsRes.rows });
});

router.post("/", authenticate, authorize(...MANAGE_ROLES), async (req: AuthedRequest, res) => {
  const { name, collector_id, vehicle_id, scheduled_date, collection_ids, estimated_distance_km, estimated_duration_min } = req.body || {};
  if (!name || !scheduled_date || !Array.isArray(collection_ids) || collection_ids.length === 0) {
    return res.status(400).json({ error: "name, scheduled_date, and at least one collection_id are required." });
  }

  const code = await nextRouteCode();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const routeRes = await client.query(
      `INSERT INTO routes (route_code, name, collector_id, vehicle_id, scheduled_date, estimated_distance_km, estimated_duration_min, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [code, name, collector_id || null, vehicle_id || null, scheduled_date, estimated_distance_km || null, estimated_duration_min || null, req.user!.id]
    );
    const routeId = routeRes.rows[0].id;

    for (let idx = 0; idx < collection_ids.length; idx++) {
      await client.query(
        `INSERT INTO route_stops (route_id, collection_id, stop_order) VALUES ($1,$2,$3)`,
        [routeId, collection_ids[idx], idx + 1]
      );
    }
    await client.query("COMMIT");

    await logAudit({
      userId: req.user!.id,
      action: "CREATE",
      recordType: "route",
      recordId: routeId,
      description: `${req.user!.fullName} (${req.user!.role}) created route ${code} with ${collection_ids.length} stops.`,
      ip: req.ip,
    });

    res.status(201).json({ route: routeRes.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Couldn't create route." });
  } finally {
    client.release();
  }
});

router.patch("/:id/start", authenticate, authorize(...MANAGE_ROLES, "COLLECTOR"), async (req: AuthedRequest, res) => {
  const route = (await pool.query("SELECT * FROM routes WHERE id = $1", [req.params.id])).rows[0];
  if (!route) return res.status(404).json({ error: "Route not found." });
  if (req.user!.role === "COLLECTOR" && route.collector_id !== req.user!.id) {
    return res.status(403).json({ error: "You can only start your own routes." });
  }
  const result = await pool.query(
    `UPDATE routes SET status = 'IN_PROGRESS', started_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  res.json({ route: result.rows[0] });
});

// Reorder stops (drag-and-drop on the supervisor side)
router.patch("/:id/reorder", authenticate, authorize(...MANAGE_ROLES), async (req: AuthedRequest, res) => {
  const { stop_ids } = req.body || {}; // array of route_stop ids in new order
  if (!Array.isArray(stop_ids)) return res.status(400).json({ error: "stop_ids array required." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let idx = 0; idx < stop_ids.length; idx++) {
      await client.query(`UPDATE route_stops SET stop_order = $1 WHERE id = $2 AND route_id = $3`, [idx + 1, stop_ids[idx], req.params.id]);
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Couldn't reorder stops." });
  } finally {
    client.release();
  }
});

// Single-stop update — used for ONLINE completions. If the stop has a bin_id
// assigned, scanned_code must match that bin's bin_code for scan_verified to
// be true — but completion is still allowed without a match (e.g. a bin was
// physically swapped), it just won't show as QR-verified in the audit trail.
router.patch("/stops/:stopId", authenticate, authorize(...MANAGE_ROLES, "COLLECTOR"), async (req: AuthedRequest, res) => {
  const { status, arrived_at, scanned_code } = req.body || {};

  const stopInfo = await pool.query(
    `SELECT rs.id, rs.bin_id, r.collector_id FROM route_stops rs JOIN routes r ON r.id = rs.route_id WHERE rs.id = $1`,
    [req.params.stopId]
  );
  if (!stopInfo.rows[0]) return res.status(404).json({ error: "Stop not found." });

  if (req.user!.role === "COLLECTOR" && stopInfo.rows[0].collector_id !== req.user!.id) {
    return res.status(403).json({ error: "You can only update your own stops." });
  }

  let scanVerified = false;
  if (scanned_code) {
    const stopBin = await pool.query(
      `SELECT b.bin_code FROM route_stops rs JOIN bins b ON b.id = rs.bin_id WHERE rs.id = $1`,
      [req.params.stopId]
    );
    scanVerified = !!stopBin.rows[0] && stopBin.rows[0].bin_code === scanned_code;
  }

  const result = await pool.query(
    `UPDATE route_stops
     SET status = COALESCE($1, status), arrived_at = COALESCE($2, arrived_at),
         scanned_code = COALESCE($3, scanned_code), scan_verified = scan_verified OR $4,
         synced = true
     WHERE id = $5 RETURNING *`,
    [status, arrived_at, scanned_code || null, scanVerified, req.params.stopId]
  );

  // If this stop is tied to a physical bin and is now complete, reset that
  // bin's fill level too — otherwise a bin can be "collected" on the ground
  // but keep showing CRITICAL/full in the Smart Bins view indefinitely.
  if (status === "COMPLETED" && stopInfo.rows[0].bin_id) {
    await pool.query(
      `UPDATE bins SET fill_level_pct = 0, status = 'NORMAL', last_collected_at = now(),
         next_scheduled_at = now() + interval '2 days', updated_at = now()
       WHERE id = $1`,
      [stopInfo.rows[0].bin_id]
    );
  }

  // check whether the whole route is now complete
  const route = await pool.query(
    `SELECT r.id, COUNT(rs.*)::int AS total, COUNT(*) FILTER (WHERE rs.status = 'COMPLETED')::int AS done
     FROM routes r JOIN route_stops rs ON rs.route_id = r.id WHERE r.id = $1 GROUP BY r.id`,
    [result.rows[0].route_id]
  );
  if (route.rows[0] && route.rows[0].total === route.rows[0].done) {
    await pool.query(`UPDATE routes SET status = 'COMPLETED', completed_at = now() WHERE id = $1`, [route.rows[0].id]);
  }

  res.json({ stop: result.rows[0], scan_verified: scanVerified });
});

// Supervisors assign which physical bin a stop corresponds to, so the
// collector's QR scan has something concrete to verify against.
router.patch("/stops/:stopId/bin", authenticate, authorize("SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR"), async (req: AuthedRequest, res) => {
  const { bin_id } = req.body || {};
  const result = await pool.query(`UPDATE route_stops SET bin_id = $1 WHERE id = $2 RETURNING *`, [bin_id || null, req.params.stopId]);
  if (!result.rows[0]) return res.status(404).json({ error: "Stop not found." });
  res.json({ stop: result.rows[0] });
});

// OFFLINE SYNC — the mobile collector app queues completed stops locally
// while offline (with a client-generated timestamp) and replays them here
// in one batch once connectivity returns. Each item is applied independently
// so a partial batch failure doesn't block the rest.
router.post("/sync", authenticate, authorize(...MANAGE_ROLES, "COLLECTOR"), async (req: AuthedRequest, res) => {
  const { pending } = req.body || {}; // [{ stop_id, status, arrived_at_client }]
  if (!Array.isArray(pending)) return res.status(400).json({ error: "pending array required." });

  const results: any[] = [];
  for (const item of pending) {
    try {
      // Ownership check: collectors may only sync stops on their own routes
      if (req.user!.role === "COLLECTOR") {
        const owns = await pool.query(
          `SELECT rs.id FROM route_stops rs JOIN routes r ON r.id = rs.route_id
           WHERE rs.id = $1 AND r.collector_id = $2`,
          [item.stop_id, req.user!.id]
        );
        if (!owns.rows[0]) {
          results.push({ stop_id: item.stop_id, ok: false, error: "Not your stop." });
          continue;
        }
      }

      let scanVerified = false;
      if (item.scanned_code) {
        const stopBin = await pool.query(
          `SELECT b.bin_code FROM route_stops rs JOIN bins b ON b.id = rs.bin_id WHERE rs.id = $1`,
          [item.stop_id]
        );
        scanVerified = !!stopBin.rows[0] && stopBin.rows[0].bin_code === item.scanned_code;
      }

      const result = await pool.query(
        `UPDATE route_stops
         SET status = $1, arrived_at = $2, scanned_code = COALESCE($3, scanned_code),
             scan_verified = scan_verified OR $4, synced = true
         WHERE id = $5 RETURNING id, route_id, status`,
        [item.status, item.arrived_at_client, item.scanned_code || null, scanVerified, item.stop_id]
      );
      if (result.rows[0]) {
        const route = await pool.query(
          `SELECT r.id, COUNT(rs.*)::int AS total, COUNT(*) FILTER (WHERE rs.status = 'COMPLETED')::int AS done
           FROM routes r JOIN route_stops rs ON rs.route_id = r.id WHERE r.id = $1 GROUP BY r.id`,
          [result.rows[0].route_id]
        );
        if (route.rows[0] && route.rows[0].total === route.rows[0].done) {
          await pool.query(`UPDATE routes SET status = 'COMPLETED', completed_at = now() WHERE id = $1`, [route.rows[0].id]);
        }
        results.push({ stop_id: item.stop_id, ok: true });
      } else {
        results.push({ stop_id: item.stop_id, ok: false, error: "Stop not found." });
      }
    } catch (err) {
      results.push({ stop_id: item.stop_id, ok: false, error: "Sync failed for this stop." });
    }
  }

  res.json({ results });
});

export default router;
