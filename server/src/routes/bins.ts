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

export default router;
