import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, AuthedRequest } from "../middleware/auth";

const router = Router();

// Recent completed collections in the resident's own zone, so they have
// something concrete to confirm/rate (rather than guessing a collection ID).
router.get("/recent-in-my-zone", authenticate, async (req: AuthedRequest, res) => {
  const me = await pool.query("SELECT zone_id FROM users WHERE id = $1", [req.user!.id]);
  const zoneId = me.rows[0]?.zone_id;
  if (!zoneId) return res.json({ collections: [] });

  const result = await pool.query(
    `SELECT c.id, c.collection_code, c.location, c.scheduled_date, c.actual_pickup_time, c.waste_type,
            cc.id AS confirmation_id, cc.rating, cc.comment
     FROM collections c
     LEFT JOIN collection_confirmations cc ON cc.collection_id = c.id AND cc.resident_id = $1
     WHERE c.zone_id = $2 AND c.status = 'COMPLETED'
     ORDER BY c.actual_pickup_time DESC NULLS LAST LIMIT 10`,
    [req.user!.id, zoneId]
  );
  res.json({ collections: result.rows });
});

router.post("/", authenticate, async (req: AuthedRequest, res) => {
  const { collection_id, rating, comment } = req.body || {};
  if (!collection_id) return res.status(400).json({ error: "collection_id is required." });
  if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) {
    return res.status(400).json({ error: "rating must be between 1 and 5." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO collection_confirmations (collection_id, resident_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (collection_id, resident_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
       RETURNING *`,
      [collection_id, req.user!.id, rating || null, comment || null]
    );
    res.status(201).json({ confirmation: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Couldn't save your confirmation." });
  }
});

export default router;
