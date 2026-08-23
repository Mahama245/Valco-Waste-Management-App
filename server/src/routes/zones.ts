import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, authorize, AuthedRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

// Public — zone names aren't sensitive, and the resident signup form needs
// this list before the person has an account or token.
router.get("/", async (_req, res) => {
  const result = await pool.query("SELECT id, name, code, description FROM zones ORDER BY name");
  res.json({ zones: result.rows });
});

router.post("/", authenticate, authorize("SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER"), async (req: AuthedRequest, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Zone name is required." });

  const countRes = await pool.query("SELECT COUNT(*)::int AS n FROM zones");
  const code = "Z" + String(countRes.rows[0].n + 1).padStart(3, "0");

  const result = await pool.query(
    "INSERT INTO zones (name, code, description) VALUES ($1, $2, $3) RETURNING *",
    [name.trim(), code, description || null]
  );

  await logAudit({
    userId: req.user!.id,
    action: "CREATE",
    recordType: "zone",
    recordId: result.rows[0].id,
    description: `${req.user!.fullName} (${req.user!.role}) added a new zone: ${name.trim()}.`,
    ip: req.ip,
  });

  res.status(201).json({ zone: result.rows[0] });
});

export default router;
