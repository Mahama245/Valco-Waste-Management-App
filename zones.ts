import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { pool } from "../db/pool";
import { signToken, authenticate, AuthedRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    const clean = String(username).trim().toLowerCase();

    const result = await pool.query(
      "SELECT id, full_name, username, password_hash, role, is_active FROM users WHERE username = $1",
      [clean]
    );
    const user = result.rows[0];
    if (!user || !user.is_active || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    await pool.query("UPDATE users SET last_login = now() WHERE id = $1", [user.id]);

    const token = signToken({ id: user.id, username: user.username, role: user.role, fullName: user.full_name });

    await logAudit({
      userId: user.id,
      action: "LOGIN",
      recordType: "user",
      recordId: user.id,
      description: `${user.full_name} (${user.role}) logged in.`,
      ip: req.ip,
    });

    res.json({
      token,
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login." });
  }
});

router.get("/me", authenticate, async (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

// Public self-registration — residents only. Staff accounts (collectors,
// supervisors, admins, etc.) are still created by an administrator via
// /api/users, never through this open endpoint.
router.post("/register", async (req, res) => {
  try {
    const { full_name, username, password, email, zone_id } = req.body || {};
    if (!full_name || !username || !password) {
      return res.status(400).json({ error: "full_name, username, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    const clean = String(username).trim().toLowerCase();

    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [clean]);
    if (existing.rows[0]) return res.status(409).json({ error: "That username is already taken." });

    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, role, department, zone_id)
       VALUES ($1, $2, $3, $4, 'RESIDENT', 'Resident', $5)
       RETURNING id, full_name, username, role`,
      [full_name, clean, email || null, hash, zone_id || null]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, username: user.username, role: user.role, fullName: user.full_name });

    await logAudit({
      userId: user.id,
      action: "CREATE",
      recordType: "user",
      recordId: user.id,
      description: `${full_name} self-registered as a Resident.`,
      ip: req.ip,
    });

    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
    });
  } catch (err: any) {
    if (err.code === "23505") {
      console.error("REGISTER duplicate-key detail:", err.detail, "| constraint:", err.constraint);
      const field = err.constraint?.includes("email")
        ? "email"
        : err.constraint?.includes("username")
        ? "username"
        : "username or email";
      return res.status(409).json({ error: `That ${field} is already registered.` });
    }
    console.error(err);
    res.status(500).json({ error: "Server error during registration." });
  }
});

export default router;
