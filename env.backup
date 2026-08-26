import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/summary", authenticate, async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const [todayStats, statusCounts, wasteComposition, zonePerformance, recentAudit, binStats, incidentStats, vehicleStats] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE scheduled_date = $1) AS scheduled_today,
         COUNT(*) FILTER (WHERE scheduled_date = $1 AND status = 'COMPLETED') AS completed_today,
         COUNT(*) FILTER (WHERE scheduled_date = $1 AND status = 'PENDING') AS pending_today,
         COUNT(*) FILTER (WHERE scheduled_date = $1 AND status = 'MISSED') AS missed_today,
         COALESCE(SUM(quantity_collected_kg) FILTER (WHERE scheduled_date = $1), 0) AS kg_collected_today
       FROM collections`,
      [today]
    ),
    pool.query(`SELECT status, COUNT(*)::int AS count FROM collections GROUP BY status`),
    pool.query(
      `SELECT waste_type, COALESCE(SUM(quantity_collected_kg), 0) AS total_kg, COUNT(*)::int AS count
       FROM collections WHERE status = 'COMPLETED' GROUP BY waste_type ORDER BY total_kg DESC`
    ),
    pool.query(
      `SELECT z.name AS zone_name,
              COUNT(*) FILTER (WHERE c.status = 'COMPLETED')::int AS completed,
              COUNT(*) FILTER (WHERE c.status = 'MISSED')::int AS missed,
              COUNT(*)::int AS total
       FROM collections c JOIN zones z ON z.id = c.zone_id
       GROUP BY z.name ORDER BY total DESC LIMIT 10`
    ),
    pool.query(`SELECT description, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 15`),
    pool.query(
      `SELECT COUNT(*)::int AS total_bins,
              COUNT(*) FILTER (WHERE status = 'CRITICAL')::int AS critical_bins,
              COUNT(*) FILTER (WHERE status = 'NEAR_CAPACITY')::int AS near_capacity_bins
       FROM bins`
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED','CLOSED'))::int AS open_incidents,
              COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND status NOT IN ('RESOLVED','CLOSED'))::int AS critical_open
       FROM incidents`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total_vehicles,
              COUNT(*) FILTER (WHERE status IN ('EN_ROUTE','COLLECTING','RETURNING','ASSIGNED'))::int AS active_vehicles
       FROM vehicles`
    ),
  ]);

  const t = todayStats.rows[0];
  const scheduledToday = parseInt(t.scheduled_today, 10) || 0;
  const completedToday = parseInt(t.completed_today, 10) || 0;
  const efficiency = scheduledToday > 0 ? Math.round((completedToday / scheduledToday) * 1000) / 10 : 0;

  res.json({
    kpis: {
      scheduled_today: scheduledToday,
      completed_today: completedToday,
      pending_today: parseInt(t.pending_today, 10) || 0,
      missed_today: parseInt(t.missed_today, 10) || 0,
      kg_collected_today: parseFloat(t.kg_collected_today) || 0,
      collection_efficiency_pct: efficiency,
      critical_bin_alerts: binStats.rows[0].critical_bins,
      near_capacity_bins: binStats.rows[0].near_capacity_bins,
      open_incidents: incidentStats.rows[0].open_incidents,
      critical_incidents: incidentStats.rows[0].critical_open,
      active_vehicles: vehicleStats.rows[0].active_vehicles,
      total_vehicles: vehicleStats.rows[0].total_vehicles,
    },
    status_counts: statusCounts.rows,
    waste_composition: wasteComposition.rows,
    zone_performance: zonePerformance.rows,
    recent_activity: recentAudit.rows,
  });
});

export default router;
