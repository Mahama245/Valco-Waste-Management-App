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

// Admin overview: every zone with its resident count and assigned collector,
// for the Zone & Collector Management screen.
router.get(
  "/overview",
  authenticate,
  authorize("SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER"),
  async (_req, res) => {
    const result = await pool.query(
      `SELECT z.id, z.name, z.code, z.description,
              z.collector_id,
              cu.full_name AS collector_name,
              cu.username AS collector_username,
              COUNT(ru.id) FILTER (WHERE ru.role = 'RESIDENT')::int AS resident_count
       FROM zones z
       LEFT JOIN users cu ON cu.id = z.collector_id
       LEFT JOIN users ru ON ru.zone_id = z.id
       GROUP BY z.id, z.name, z.code, z.description, z.collector_id, cu.full_name, cu.username
       ORDER BY z.name`
    );
    res.json({ zones: result.rows });
  }
);

// The logged-in user's zone(s), for resident and collector dashboards.
// A collector can be responsible for several zones (zones.collector_id),
// while a resident belongs to exactly one zone (users.zone_id) — so this
// looks up the relationship that actually applies to the caller's role.
// Always returns { zones: [...] } (possibly empty).
router.get("/my-zone", authenticate, async (req: AuthedRequest, res) => {
  if (req.user!.role === "COLLECTOR") {
    const result = await pool.query(
      `SELECT z.id, z.name, z.code, z.description,
              COUNT(ru.id) FILTER (WHERE ru.role = 'RESIDENT')::int AS resident_count,
              EXISTS (
                SELECT 1 FROM collections c
                WHERE c.zone_id = z.id AND c.collector_id = $1
                  AND c.scheduled_date = CURRENT_DATE AND c.status = 'COMPLETED'
              ) AS collected_today
       FROM zones z
       LEFT JOIN users ru ON ru.zone_id = z.id
       WHERE z.collector_id = $1
       GROUP BY z.id, z.name, z.code, z.description
       ORDER BY z.name`,
      [req.user!.id]
    );
    return res.json({ zones: result.rows });
  }

  const result = await pool.query(
    `SELECT z.id, z.name, z.code, z.description, cu.full_name AS collector_name
     FROM users u
     JOIN zones z ON z.id = u.zone_id
     LEFT JOIN users cu ON cu.id = z.collector_id
     WHERE u.id = $1`,
    [req.user!.id]
  );
  res.json({ zones: result.rows });
});

// Assign (or reassign) the collector responsible for a zone. Residents keep
// their own zone_id untouched — this only changes zones.collector_id.
router.patch(
  "/:zoneId/collector",
  authenticate,
  authorize("SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER"),
  async (req: AuthedRequest, res) => {
    const zoneId = Number(req.params.zoneId);
    if (!Number.isInteger(zoneId)) return res.status(400).json({ error: "Invalid zone id." });

    const { collector_id } = req.body || {};

    const zoneRes = await pool.query("SELECT id, name, collector_id FROM zones WHERE id = $1", [zoneId]);
    if (!zoneRes.rows[0]) return res.status(404).json({ error: "Zone not found." });
    const zone = zoneRes.rows[0];

    // collector_id is required to make an assignment; pass null explicitly to unassign.
    let newCollector: { id: number; full_name: string } | null = null;
    if (collector_id !== null && collector_id !== undefined && collector_id !== "") {
      const collectorRes = await pool.query(
        "SELECT id, full_name, role FROM users WHERE id = $1",
        [collector_id]
      );
      if (!collectorRes.rows[0]) return res.status(404).json({ error: "Selected collector not found." });
      if (collectorRes.rows[0].role !== "COLLECTOR") {
        return res.status(400).json({ error: "Selected user is not an authorized collector." });
      }
      newCollector = collectorRes.rows[0];
    }

    let previousCollectorName: string | null = null;
    if (zone.collector_id) {
      const prevRes = await pool.query("SELECT full_name FROM users WHERE id = $1", [zone.collector_id]);
      previousCollectorName = prevRes.rows[0]?.full_name || null;
    }

    const updated = await pool.query(
      `UPDATE zones SET collector_id = $1 WHERE id = $2
       RETURNING id, name, code, collector_id`,
      [newCollector ? newCollector.id : null, zoneId]
    );

    await logAudit({
      userId: req.user!.id,
      action: "UPDATE",
      recordType: "zone",
      recordId: zoneId,
      description: newCollector
        ? `${req.user!.fullName} (${req.user!.role}) assigned ${newCollector.full_name} as collector for ${zone.name}${
            previousCollectorName ? ` (previously ${previousCollectorName})` : ""
          }.`
        : `${req.user!.fullName} (${req.user!.role}) removed the collector assignment for ${zone.name}${
            previousCollectorName ? ` (previously ${previousCollectorName})` : ""
          }.`,
      previousValue: { collector_id: zone.collector_id, collector_name: previousCollectorName },
      newValue: { collector_id: newCollector?.id ?? null, collector_name: newCollector?.full_name ?? null },
      ip: req.ip,
    });

    res.json({ zone: updated.rows[0] });
  }
);

// A collector scans their zone's printed QR code to record that day's
// collection for that zone. Only the collector actually assigned to the
// zone can complete it — this isn't tied to a specific route/stop, it's a
// zone-level "I collected here today" record.
router.post("/:zoneId/scan-complete", authenticate, authorize("COLLECTOR"), async (req: AuthedRequest, res) => {
  const zoneId = Number(req.params.zoneId);
  if (!Number.isInteger(zoneId)) return res.status(400).json({ error: "Invalid zone id." });

  const { scanned_code } = req.body || {};
  if (!scanned_code) return res.status(400).json({ error: "scanned_code is required." });

  const zoneRes = await pool.query("SELECT id, name, code, collector_id FROM zones WHERE id = $1", [zoneId]);
  if (!zoneRes.rows[0]) return res.status(404).json({ error: "Zone not found." });
  const zone = zoneRes.rows[0];

  if (zone.collector_id !== req.user!.id) {
    return res.status(403).json({ error: "You're not the assigned collector for this zone." });
  }

  if (String(scanned_code).trim().toUpperCase() !== zone.code.toUpperCase()) {
    return res.status(400).json({ error: "That QR code doesn't match this zone." });
  }

  // Idempotent: if already recorded as collected today, just say so instead of duplicating.
  const existing = await pool.query(
    `SELECT id, collection_code FROM collections
     WHERE zone_id = $1 AND collector_id = $2 AND scheduled_date = CURRENT_DATE AND status = 'COMPLETED'`,
    [zoneId, req.user!.id]
  );
  if (existing.rows[0]) {
    return res.json({ collection: existing.rows[0], alreadyRecorded: true });
  }

  const countRes = await pool.query("SELECT COUNT(*)::int AS n FROM collections");
  const code = `WM-2026-${String(countRes.rows[0].n + 1).padStart(6, "0")}`;

  const result = await pool.query(
    `INSERT INTO collections
       (collection_code, zone_id, location, scheduled_date, collector_id, waste_type, priority, status, actual_pickup_time, notes, created_by)
     VALUES ($1, $2, $3, CURRENT_DATE, $4, 'GENERAL', 'NORMAL', 'COMPLETED', now(), 'Recorded via zone QR scan', $4)
     RETURNING *`,
    [code, zoneId, zone.name, req.user!.id]
  );

  await logAudit({
    userId: req.user!.id,
    action: "CREATE",
    recordType: "collection",
    recordId: result.rows[0].id,
    description: `${req.user!.fullName} (${req.user!.role}) scanned the zone QR code for ${zone.name} and recorded today's collection (${code}).`,
    newValue: result.rows[0],
    ip: req.ip,
  });

  res.status(201).json({ collection: result.rows[0], alreadyRecorded: false });
});

export default router;
