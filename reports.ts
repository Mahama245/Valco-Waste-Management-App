import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, authorize, AuthedRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";
import { nextCollectionCode } from "../utils/identifiers";

const router = Router();

const MANAGE_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR"];

// List collections with filters: status, zone, waste_type, collector, date range
router.get("/", authenticate, async (req: AuthedRequest, res) => {
  const { status, zone_id, waste_type, collector_id, date_from, date_to, limit } = req.query;
  const clauses: string[] = [];
  const values: any[] = [];
  let i = 1;

  // Collectors only see their own assignments; residents see nothing here (they use complaints/reports)
  if (req.user!.role === "COLLECTOR") {
    clauses.push(`c.collector_id = $${i++}`);
    values.push(req.user!.id);
  }

  if (status) { clauses.push(`c.status = $${i++}`); values.push(status); }
  if (zone_id) { clauses.push(`c.zone_id = $${i++}`); values.push(zone_id); }
  if (waste_type) { clauses.push(`c.waste_type = $${i++}`); values.push(waste_type); }
  if (collector_id) { clauses.push(`c.collector_id = $${i++}`); values.push(collector_id); }
  if (date_from) { clauses.push(`c.scheduled_date >= $${i++}`); values.push(date_from); }
  if (date_to) { clauses.push(`c.scheduled_date <= $${i++}`); values.push(date_to); }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const lim = Math.min(parseInt(String(limit || "200"), 10) || 200, 500);

  const result = await pool.query(
    `SELECT c.id, c.collection_code, c.zone_id, z.name AS zone_name, c.location, c.scheduled_date, c.scheduled_time,
            c.collector_id, u.full_name AS collector_name, c.vehicle_id, v.registration_number AS vehicle_reg,
            c.waste_type, c.priority, c.status, c.actual_pickup_time, c.quantity_collected_kg, c.missed_reason,
            c.created_at
     FROM collections c
     LEFT JOIN zones z ON z.id = c.zone_id
     LEFT JOIN users u ON u.id = c.collector_id
     LEFT JOIN vehicles v ON v.id = c.vehicle_id
     ${where}
     ORDER BY c.scheduled_date DESC, c.id DESC
     LIMIT ${lim}`,
    values
  );
  res.json({ collections: result.rows });
});

router.get("/:id", authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, z.name AS zone_name, u.full_name AS collector_name, v.registration_number AS vehicle_reg
     FROM collections c
     LEFT JOIN zones z ON z.id = c.zone_id
     LEFT JOIN users u ON u.id = c.collector_id
     LEFT JOIN vehicles v ON v.id = c.vehicle_id
     WHERE c.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Collection not found." });
  res.json({ collection: result.rows[0] });
});

router.post("/", authenticate, authorize(...MANAGE_ROLES), async (req: AuthedRequest, res) => {
  const { zone_id, location, scheduled_date, scheduled_time, collector_id, vehicle_id, waste_type, priority } = req.body || {};
  if (!zone_id || !location || !scheduled_date) {
    return res.status(400).json({ error: "zone_id, location, and scheduled_date are required." });
  }

  const code = await nextCollectionCode();

  const result = await pool.query(
    `INSERT INTO collections (collection_code, zone_id, location, scheduled_date, scheduled_time, collector_id, vehicle_id, waste_type, priority, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'GENERAL')::waste_type,COALESCE($9,'NORMAL')::collection_priority,$10)
     RETURNING *`,
    [code, zone_id, location, scheduled_date, scheduled_time, collector_id, vehicle_id, waste_type, priority, req.user!.id]
  );

  await logAudit({
    userId: req.user!.id,
    action: "CREATE",
    recordType: "collection",
    recordId: result.rows[0].id,
    description: `${req.user!.fullName} (${req.user!.role}) created collection ${code}.`,
    newValue: result.rows[0],
    ip: req.ip,
  });

  res.status(201).json({ collection: result.rows[0] });
});

// Update status: complete / miss / cancel / reschedule / assign
router.patch("/:id/status", authenticate, authorize(...MANAGE_ROLES, "COLLECTOR"), async (req: AuthedRequest, res) => {
  const { status, quantity_collected_kg, missed_reason, actual_pickup_time } = req.body || {};
  const allowed = ["PENDING", "IN_PROGRESS", "COMPLETED", "MISSED", "CANCELLED"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status." });

  if (quantity_collected_kg !== undefined && quantity_collected_kg !== null) {
    const kg = Number(quantity_collected_kg);
    if (isNaN(kg) || kg < 0 || kg > 50000) {
      return res.status(400).json({ error: "quantity_collected_kg must be a number between 0 and 50000." });
    }
  }
  if (status === "COMPLETED" && (quantity_collected_kg === undefined || quantity_collected_kg === null)) {
    return res.status(400).json({ error: "quantity_collected_kg is required when marking a collection completed." });
  }
  if (status === "MISSED" && (!missed_reason || !String(missed_reason).trim())) {
    return res.status(400).json({ error: "missed_reason is required when marking a collection missed." });
  }

  const before = await pool.query("SELECT * FROM collections WHERE id = $1", [req.params.id]);
  if (!before.rows[0]) return res.status(404).json({ error: "Collection not found." });

  // Collectors may only update their own assigned collections
  if (req.user!.role === "COLLECTOR" && before.rows[0].collector_id !== req.user!.id) {
    return res.status(403).json({ error: "You can only update your own assigned collections." });
  }

  const result = await pool.query(
    `UPDATE collections
     SET status = $1,
         quantity_collected_kg = COALESCE($2, quantity_collected_kg),
         missed_reason = COALESCE($3, missed_reason),
         actual_pickup_time = COALESCE($4, actual_pickup_time),
         updated_at = now()
     WHERE id = $5
     RETURNING *`,
    [status, quantity_collected_kg, missed_reason, actual_pickup_time, req.params.id]
  );

  await logAudit({
    userId: req.user!.id,
    action: "UPDATE",
    recordType: "collection",
    recordId: Number(req.params.id),
    description: `${req.user!.fullName} (${req.user!.role}) changed collection ${before.rows[0].collection_code} from ${before.rows[0].status} to ${status}.`,
    previousValue: before.rows[0],
    newValue: result.rows[0],
    ip: req.ip,
  });

  res.json({ collection: result.rows[0] });
});

export default router;
