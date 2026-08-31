import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, authorize, AuthedRequest } from "../middleware/auth";

const router = Router();
const STAFF_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR"];

// Residents see only their own complaints; staff see all
router.get("/", authenticate, async (req: AuthedRequest, res) => {
  const isStaff = STAFF_ROLES.includes(req.user!.role);
  const result = await pool.query(
    isStaff
      ? `SELECT c.*, u.full_name AS resident_name FROM complaints c JOIN users u ON u.id = c.resident_id ORDER BY c.created_at DESC`
      : `SELECT c.* FROM complaints c WHERE c.resident_id = $1 ORDER BY c.created_at DESC`,
    isStaff ? [] : [req.user!.id]
  );
  res.json({ complaints: result.rows });
});

router.post("/", authenticate, async (req: AuthedRequest, res) => {
  const { category, location, description } = req.body || {};
  if (!category || !description) return res.status(400).json({ error: "category and description are required." });

  const countRes = await pool.query("SELECT COUNT(*)::int AS n FROM complaints");
  const tracking = `CMP-2026-${String(10000 + countRes.rows[0].n + 1)}`;

  const result = await pool.query(
    `INSERT INTO complaints (tracking_number, resident_id, category, location, description)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [tracking, req.user!.id, category, location || null, description]
  );
  res.status(201).json({ complaint: result.rows[0] });
});

router.patch("/:id", authenticate, authorize(...STAFF_ROLES), async (req, res) => {
  const { status, response } = req.body || {};
  const result = await pool.query(
    `UPDATE complaints SET status = COALESCE($1, status), response = COALESCE($2, response), updated_at = now()
     WHERE id = $3 RETURNING *`,
    [status, response, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Complaint not found." });
  res.json({ complaint: result.rows[0] });
});

export default router;
