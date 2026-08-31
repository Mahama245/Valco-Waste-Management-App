import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, authorize, AuthedRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();
const MANAGE_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR"];

router.get("/", authenticate, async (req, res) => {
  const { zone_id, status } = req.query;
  const clauses: string[] = [];
  const values: any[] = [];
  let i = 1;
  if (zone_id) { clauses.push(`b.zone_id = $${i++}`); values.push(zone_id); }
  if (status) { clauses.push(`b.status = $${i++}`); values.push(status); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT b.id, b.bin_code, b.zone_id, z.name AS zone_name, b.location, b.lat, b.lng, b.waste_type,
            b.capacity_liters, b.fill_level_pct, b.status, b.condition, b.last_collected_at, b.next_scheduled_at
     FROM bins b JOIN zones z ON z.id = b.zone_id
     ${where}
     ORDER BY b.fill_level_pct DESC`,
    values
  );
  res.json({ bins: result.rows });
});

router.get("/alerts", authenticate, async (_req, res) => {
  const result = await pool.query(
    `SELECT b.id, b.bin_code, z.name AS zone_name, b.fill_level_pct, b.status
     FROM bins b JOIN zones z ON z.id = b.zone_id
     WHERE b.fill_level_pct >= 70
     ORDER BY b.fill_level_pct DESC`
  );
  res.json({ alerts: result.rows });
});

// Simulates an IoT sensor push updating fill level (in a real deployment this
// would be called by the sensor gateway, not a human via the UI)
router.patch("/:id/fill-level", authenticate, authorize(...MANAGE_ROLES), async (req: AuthedRequest, res) => {
  const { fill_level_pct } = req.body || {};
  if (typeof fill_level_pct !== "number" || fill_level_pct < 0 || fill_level_pct > 100) {
    return res.status(400).json({ error: "fill_level_pct must be a number between 0 and 100." });
  }
  const status = fill_level_pct >= 95 ? "CRITICAL" : fill_level_pct >= 70 ? "NEAR_CAPACITY" : "NORMAL";

  const result = await pool.query(
    `UPDATE bins SET fill_level_pct = $1, status = $2, updated_at = now() WHERE id = $3 RETURNING *`,
    [fill_level_pct, status, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Bin not found." });

  if (status !== "NORMAL") {
    await logAudit({
      userId: req.user!.id,
      action: "UPDATE",
      recordType: "bin",
      recordId: Number(req.params.id),
      description: `Bin ${result.rows[0].bin_code} reached ${fill_level_pct}% fill (${status}).`,
      ip: req.ip,
    });
  }

  res.json({ bin: result.rows[0] });
});

router.patch("/:id/collected", authenticate, authorize(...MANAGE_ROLES, "COLLECTOR"), async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `UPDATE bins SET fill_level_pct = 0, status = 'NORMAL', last_collected_at = now(),
       next_scheduled_at = now() + interval '2 days', updated_at = now()
     WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Bin not found." });
  res.json({ bin: result.rows[0] });
});

router.get("/by-code/:code", authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT b.id, b.bin_code, b.location, z.name AS zone_name, b.waste_type, b.fill_level_pct, b.status
     FROM bins b JOIN zones z ON z.id = b.zone_id WHERE b.bin_code = $1`,
    [req.params.code]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "No bin with that code." });
  res.json({ bin: result.rows[0] });
});

// Create a new bin (a new physical collection point / location).
router.post("/", authenticate, authorize(...MANAGE_ROLES), async (req: AuthedRequest, res) => {
  const { zone_id, location, waste_type, capacity_liters, lat, lng } = req.body || {};
  if (!zone_id || !location) {
    return res.status(400).json({ error: "zone_id and location are required." });
  }

  const countRes = await pool.query("SELECT COUNT(*)::int AS n FROM bins");
  const binCode = `WM-BIN-${String(10000 + countRes.rows[0].n + 1)}`;

  const result = await pool.query(
    `INSERT INTO bins (bin_code, zone_id, location, lat, lng, waste_type, capacity_liters)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,'GENERAL')::waste_type,COALESCE($7,1100))
     RETURNING *`,
    [binCode, zone_id, location, lat || null, lng || null, waste_type, capacity_liters]
  );

  await logAudit({
    userId: req.user!.id,
    action: "CREATE",
    recordType: "bin",
    recordId: result.rows[0].id,
    description: `${req.user!.fullName} (${req.user!.role}) added a new collection point: ${binCode} at ${location}.`,
    ip: req.ip,
  });

  res.status(201).json({ bin: result.rows[0] });
});

// Edit an existing bin's details (location, zone, waste type, capacity, coordinates).
router.patch("/:id", authenticate, authorize(...MANAGE_ROLES), async (req: AuthedRequest, res) => {
  const { zone_id, location, waste_type, capacity_liters, lat, lng, condition } = req.body || {};

  const before = await pool.query("SELECT * FROM bins WHERE id = $1", [req.params.id]);
  if (!before.rows[0]) return res.status(404).json({ error: "Bin not found." });

  const result = await pool.query(
    `UPDATE bins SET
       zone_id = COALESCE($1, zone_id),
       location = COALESCE($2, location),
       waste_type = COALESCE($3, waste_type),
       capacity_liters = COALESCE($4, capacity_liters),
       lat = COALESCE($5, lat),
       lng = COALESCE($6, lng),
       condition = COALESCE($7, condition),
       updated_at = now()
     WHERE id = $8 RETURNING *`,
    [zone_id, location, waste_type, capacity_liters, lat, lng, condition, req.params.id]
  );

  await logAudit({
    userId: req.user!.id,
    action: "UPDATE",
    recordType: "bin",
    recordId: Number(req.params.id),
    description: `${req.user!.fullName} (${req.user!.role}) updated collection point ${before.rows[0].bin_code}.`,
    previousValue: before.rows[0],
    newValue: result.rows[0],
    ip: req.ip,
  });

  res.json({ bin: result.rows[0] });
});

// Remove a bin that no longer exists physically (e.g. decommissioned location).
router.delete("/:id", authenticate, authorize(...MANAGE_ROLES), async (req: AuthedRequest, res) => {
  try {
    const result = await pool.query("DELETE FROM bins WHERE id = $1 RETURNING bin_code, location", [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Bin not found." });

    await logAudit({
      userId: req.user!.id,
      action: "DELETE",
      recordType: "bin",
      recordId: Number(req.params.id),
      description: `${req.user!.fullName} (${req.user!.role}) removed collection point ${result.rows[0].bin_code} (${result.rows[0].location}).`,
      ip: req.ip,
    });

    res.json({ ok: true });
  } catch (err: any) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "This bin is still assigned to one or more routes. Unassign it from those stops first." });
    }
    console.error(err);
    res.status(500).json({ error: "Couldn't remove this collection point." });
  }
});

export default router;
