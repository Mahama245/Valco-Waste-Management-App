import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, authorize, AuthedRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();
const TRIAGE_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "HSE_OFFICER"];

router.get("/", authenticate, async (req, res) => {
  const { status, severity, category } = req.query;
  const clauses: string[] = [];
  const values: any[] = [];
  let i = 1;
  if (status) { clauses.push(`i.status = $${i++}`); values.push(status); }
  if (severity) { clauses.push(`i.severity = $${i++}`); values.push(severity); }
  if (category) { clauses.push(`i.category = $${i++}`); values.push(category); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT i.id, i.ticket_number, i.location, i.lat, i.lng, i.category, i.severity, i.description,
            i.status, i.resolution, i.resolved_at, i.created_at,
            z.name AS zone_name, r.full_name AS reporter_name, o.full_name AS officer_name
     FROM incidents i
     LEFT JOIN zones z ON z.id = i.zone_id
     LEFT JOIN users r ON r.id = i.reporter_id
     LEFT JOIN users o ON o.id = i.assigned_officer_id
     ${where}
     ORDER BY i.created_at DESC`,
    values
  );
  res.json({ incidents: result.rows });
});

router.post("/", authenticate, async (req: AuthedRequest, res) => {
  const { zone_id, location, category, severity, description, lat, lng } = req.body || {};
  if (!location || !category || !description) {
    return res.status(400).json({ error: "location, category, and description are required." });
  }
  const countRes = await pool.query("SELECT COUNT(*)::int AS n FROM incidents");
  const ticket = `INC-2026-${String(10000 + countRes.rows[0].n + 1)}`;

  const result = await pool.query(
    `INSERT INTO incidents (ticket_number, reporter_id, zone_id, location, lat, lng, category, severity, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'MEDIUM'),$9) RETURNING *`,
    [ticket, req.user!.id, zone_id || null, location, lat || null, lng || null, category, severity, description]
  );

  await logAudit({
    userId: req.user!.id,
    action: "CREATE",
    recordType: "incident",
    recordId: result.rows[0].id,
    description: `${req.user!.fullName} reported incident ${ticket} (${category.replace(/_/g, " ")}).`,
    ip: req.ip,
  });

  res.status(201).json({ incident: result.rows[0] });
});

router.patch("/:id", authenticate, authorize(...TRIAGE_ROLES), async (req: AuthedRequest, res) => {
  const { status, assigned_officer_id, resolution } = req.body || {};
  const before = await pool.query("SELECT * FROM incidents WHERE id = $1", [req.params.id]);
  if (!before.rows[0]) return res.status(404).json({ error: "Incident not found." });

  const result = await pool.query(
    `UPDATE incidents SET
       status = COALESCE($1, status),
       assigned_officer_id = COALESCE($2, assigned_officer_id),
       resolution = COALESCE($3, resolution),
       resolved_at = CASE WHEN $1 IN ('RESOLVED','CLOSED') THEN now() ELSE resolved_at END,
       updated_at = now()
     WHERE id = $4 RETURNING *`,
    [status, assigned_officer_id, resolution, req.params.id]
  );

  await logAudit({
    userId: req.user!.id,
    action: "UPDATE",
    recordType: "incident",
    recordId: Number(req.params.id),
    description: `${req.user!.fullName} updated incident ${before.rows[0].ticket_number} from ${before.rows[0].status} to ${result.rows[0].status}.`,
    previousValue: before.rows[0],
    newValue: result.rows[0],
    ip: req.ip,
  });

  res.json({ incident: result.rows[0] });
});

export default router;
