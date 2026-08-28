import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/pool";
import { authenticate, authorize, AuthedRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = Router();
const ADMIN_ROLES = ["SUPER_ADMIN", "ICT_ADMIN"];

router.get("/", authenticate, authorize(...ADMIN_ROLES, "WASTE_MANAGER", "SUPERVISOR"), async (_req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.email, u.role, u.department, u.is_active, u.last_login, z.name AS zone_name
     FROM users u LEFT JOIN zones z ON z.id = u.zone_id
     ORDER BY u.role, u.full_name`
  );
  res.json({ users: result.rows });
});

router.post("/", authenticate, authorize(...ADMIN_ROLES), async (req: AuthedRequest, res) => {
  const { full_name, username, email, password, role, department, zone_id } = req.body || {};
  if (!full_name || !username || !password || !role) {
    return res.status(400).json({ error: "full_name, username, password, and role are required." });
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, role, department, zone_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, full_name, username, email, role, department, is_active`,
      [full_name, username.toLowerCase(), email || null, hash, role, department || null, zone_id || null]
    );
    await logAudit({
      userId: req.user!.id,
      action: "CREATE",
      recordType: "user",
      recordId: result.rows[0].id,
      description: `${req.user!.fullName} (${req.user!.role}) created a new ${role} account for ${full_name}.`,
      ip: req.ip,
    });
    res.status(201).json({ user: result.rows[0] });
  } catch (err: any) {
    if (err.code === "23505") {
      console.error("ADMIN CREATE duplicate-key detail:", err.detail, "| constraint:", err.constraint);
      const field = err.constraint?.includes("email")
        ? "email"
        : err.constraint?.includes("username")
        ? "username"
        : "username or email";
      return res.status(409).json({ error: `That ${field} already exists.` });
    }
    console.error(err);
    res.status(500).json({ error: "Server error creating user." });
  }
});

router.patch("/:id/deactivate", authenticate, authorize(...ADMIN_ROLES), async (req: AuthedRequest, res) => {
  if (Number(req.params.id) === req.user!.id) {
    return res.status(400).json({ error: "You can't deactivate your own account." });
  }
  const result = await pool.query("UPDATE users SET is_active = false, updated_at = now() WHERE id = $1 RETURNING full_name, role", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "User not found." });
  await logAudit({
    userId: req.user!.id,
    action: "UPDATE",
    recordType: "user",
    recordId: Number(req.params.id),
    description: `${req.user!.fullName} (${req.user!.role}) deactivated account for ${result.rows[0].full_name} (${result.rows[0].role}).`,
    ip: req.ip,
  });
  res.json({ ok: true });
});

router.patch("/:id/reactivate", authenticate, authorize(...ADMIN_ROLES), async (req: AuthedRequest, res) => {
  const result = await pool.query("UPDATE users SET is_active = true, updated_at = now() WHERE id = $1 RETURNING full_name, role", [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "User not found." });
  await logAudit({
    userId: req.user!.id,
    action: "UPDATE",
    recordType: "user",
    recordId: Number(req.params.id),
    description: `${req.user!.fullName} (${req.user!.role}) reactivated account for ${result.rows[0].full_name} (${result.rows[0].role}).`,
    ip: req.ip,
  });
  res.json({ ok: true });
});

// Full edit — including changing someone's role (e.g. promoting to admin).
router.patch("/:id", authenticate, authorize(...ADMIN_ROLES), async (req: AuthedRequest, res) => {
  const { full_name, role, department, zone_id, email } = req.body || {};

  const before = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
  if (!before.rows[0]) return res.status(404).json({ error: "User not found." });

  if (Number(req.params.id) === req.user!.id && role && role !== before.rows[0].role) {
    return res.status(400).json({ error: "You can't change your own role. Have another admin do it." });
  }

  const result = await pool.query(
    `UPDATE users SET
       full_name = COALESCE($1, full_name),
       role = COALESCE($2, role),
       department = COALESCE($3, department),
       zone_id = COALESCE($4, zone_id),
       email = COALESCE($5, email),
       updated_at = now()
     WHERE id = $6
     RETURNING id, full_name, username, email, role, department, is_active`,
    [full_name, role, department, zone_id, email, req.params.id]
  );

  await logAudit({
    userId: req.user!.id,
    action: "UPDATE",
    recordType: "user",
    recordId: Number(req.params.id),
    description:
      role && role !== before.rows[0].role
        ? `${req.user!.fullName} (${req.user!.role}) changed ${before.rows[0].full_name}'s role from ${before.rows[0].role} to ${role}.`
        : `${req.user!.fullName} (${req.user!.role}) updated ${before.rows[0].full_name}'s account details.`,
    previousValue: before.rows[0],
    newValue: result.rows[0],
    ip: req.ip,
  });

  res.json({ user: result.rows[0] });
});

// Permanent delete. Blocked automatically if this account has historical
// records attached (collections, audit entries, etc.) — deactivate instead
// for anyone with real history; this is for cleaning up accounts that were
// never actually used.
router.delete("/:id", authenticate, authorize(...ADMIN_ROLES), async (req: AuthedRequest, res) => {
  if (Number(req.params.id) === req.user!.id) {
    return res.status(400).json({ error: "You can't delete your own account." });
  }
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING full_name, role", [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "User not found." });

    await logAudit({
      userId: req.user!.id,
      action: "DELETE",
      recordType: "user",
      recordId: Number(req.params.id),
      description: `${req.user!.fullName} (${req.user!.role}) permanently deleted the account for ${result.rows[0].full_name} (${result.rows[0].role}).`,
      ip: req.ip,
    });

    res.json({ ok: true });
  } catch (err: any) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "This account has history attached (collections, incidents, audit entries, etc.) and can't be permanently deleted. Deactivate it instead." });
    }
    console.error(err);
    res.status(500).json({ error: "Couldn't delete this account." });
  }
});

router.patch("/:id/reset-password", authenticate, authorize(...ADMIN_ROLES), async (req: AuthedRequest, res) => {
  const { new_password } = req.body || {};
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: "new_password must be at least 6 characters." });
  }
  const hash = bcrypt.hashSync(new_password, 10);
  const result = await pool.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 RETURNING full_name", [hash, req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "User not found." });
  await logAudit({
    userId: req.user!.id,
    action: "UPDATE",
    recordType: "user",
    recordId: Number(req.params.id),
    description: `${req.user!.fullName} (${req.user!.role}) reset the password for ${result.rows[0].full_name}.`,
    ip: req.ip,
  });
  res.json({ ok: true });
});

export default router;
