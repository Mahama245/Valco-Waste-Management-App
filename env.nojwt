import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, authorize } from "../middleware/auth";

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

export default router;
