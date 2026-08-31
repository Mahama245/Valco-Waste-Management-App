import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, AuthedRequest } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, type, title, body, record_type, record_id, is_read, email_dispatched, sms_dispatched, created_at
     FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user!.id]
  );
  res.json({ notifications: result.rows });
});

router.patch("/:id/read", authenticate, async (req: AuthedRequest, res) => {
  await pool.query("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2", [req.params.id, req.user!.id]);
  res.json({ ok: true });
});

router.patch("/read-all", authenticate, async (req: AuthedRequest, res) => {
  await pool.query("UPDATE notifications SET is_read = true WHERE user_id = $1", [req.user!.id]);
  res.json({ ok: true });
});

export default router;
