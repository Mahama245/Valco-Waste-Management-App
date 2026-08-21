import { Router } from "express";
import { pool } from "../db/pool";

const router = Router();

// Public — zone names aren't sensitive, and the resident signup form needs
// this list before the person has an account or token.
router.get("/", async (_req, res) => {
  const result = await pool.query("SELECT id, name, code, description FROM zones ORDER BY name");
  res.json({ zones: result.rows });
});

export default router;
