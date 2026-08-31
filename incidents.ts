import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, authorize, AuthedRequest } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, authorize("SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER"), async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || "100"), 10) || 100, 500);
  const result = await pool.query(
    `SELECT a.id, a.action, a.record_type, a.record_id, a.description, a.created_at, u.full_name AS actor_name, u.role AS actor_role
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT ${limit}`
  );
  res.json({ audit_logs: result.rows });
});

// Deletion is restricted to SUPER_ADMIN specifically (narrower than the GET
// above) since removing audit history is a meaningfully bigger action than
// viewing it. Each deletion is itself logged as a new entry, so there's
// always a record that a record was removed, even if not what it said.
router.delete("/:id", authenticate, authorize("SUPER_ADMIN"), async (req: AuthedRequest, res) => {
  const result = await pool.query("DELETE FROM audit_logs WHERE id = $1 RETURNING description", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Log entry not found." });

  await pool.query(
    `INSERT INTO audit_logs (user_id, action, record_type, record_id, description)
     VALUES ($1, 'DELETE', 'audit_log', $2, $3)`,
    [req.user!.id, req.params.id, `${req.user!.fullName} deleted an audit log entry: "${result.rows[0].description}"`]
  );

  res.json({ ok: true });
});

router.delete("/", authenticate, authorize("SUPER_ADMIN"), async (req: AuthedRequest, res) => {
  const countRes = await pool.query("SELECT COUNT(*)::int AS n FROM audit_logs");
  await pool.query("TRUNCATE audit_logs");

  await pool.query(
    `INSERT INTO audit_logs (user_id, action, record_type, description)
     VALUES ($1, 'DELETE', 'audit_log', $2)`,
    [req.user!.id, `${req.user!.fullName} cleared the entire audit log (${countRes.rows[0].n} entries removed).`]
  );

  res.json({ ok: true, cleared: countRes.rows[0].n });
});

export default router;
