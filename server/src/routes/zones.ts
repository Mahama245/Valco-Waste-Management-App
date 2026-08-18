import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, async (_req, res) => {
  const result = await pool.query("SELECT id, name, code, description FROM zones ORDER BY name");
  res.json({ zones: result.rows });
});

export default router;
