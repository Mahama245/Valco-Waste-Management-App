import { Router } from "express";
import { pool } from "../db/pool";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();
const REPORT_ROLES = ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "MANAGEMENT"];

interface Insight {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
}

// All insights here are simple rule-based aggregations over real seeded data —
// there is no ML/AI model behind this. Each one states the rule it applied so
// it's auditable, and the UI labels the whole section as recommendations.
router.get("/", authenticate, authorize(...REPORT_ROLES), async (_req, res) => {
  const insights: Insight[] = [];

  // Rule 1: zones with a missed-collection rate above 20% (min 3 scheduled, so small samples don't skew this)
  const missedZones = await pool.query(
    `SELECT z.name, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE c.status='MISSED')::int AS missed
     FROM collections c JOIN zones z ON z.id = c.zone_id
     GROUP BY z.name HAVING COUNT(*) >= 3
     ORDER BY (COUNT(*) FILTER (WHERE c.status='MISSED')::float / COUNT(*)) DESC LIMIT 3`
  );
  for (const row of missedZones.rows) {
    const rate = Math.round((row.missed / row.total) * 100);
    if (rate >= 15) {
      insights.push({
        id: `missed-zone-${row.name}`,
        title: `${row.name} has a high missed-collection rate`,
        description: `${row.missed} of ${row.total} scheduled collections were missed (${rate}%) in the seeded data. Consider reviewing route assignment or access conditions in this zone.`,
        severity: rate >= 30 ? "critical" : "warning",
      });
    }
  }

  // Rule 2: bins currently at critical or near-capacity — candidates for increased pickup frequency
  const hotBins = await pool.query(
    `SELECT z.name AS zone_name, COUNT(*)::int AS bin_count
     FROM bins b JOIN zones z ON z.id = b.zone_id
     WHERE b.status IN ('CRITICAL','NEAR_CAPACITY')
     GROUP BY z.name ORDER BY bin_count DESC LIMIT 3`
  );
  for (const row of hotBins.rows) {
    if (row.bin_count >= 2) {
      insights.push({
        id: `bins-${row.zone_name}`,
        title: `${row.zone_name} has multiple bins near capacity`,
        description: `${row.bin_count} bins in this zone are currently at Near Capacity or Critical fill level. A recommended action is increasing collection frequency for this zone.`,
        severity: "warning",
      });
    }
  }

  // Rule 3: collectors with the most missed jobs (repeated delays proxy)
  const delayedCollectors = await pool.query(
    `SELECT u.full_name, COUNT(*) FILTER (WHERE c.status='MISSED')::int AS missed
     FROM users u JOIN collections c ON c.collector_id = u.id
     WHERE u.role='COLLECTOR'
     GROUP BY u.full_name HAVING COUNT(*) FILTER (WHERE c.status='MISSED') >= 2
     ORDER BY missed DESC LIMIT 3`
  );
  for (const row of delayedCollectors.rows) {
    insights.push({
      id: `collector-${row.full_name}`,
      title: `${row.full_name} has ${row.missed} missed collections`,
      description: `This collector has repeated missed collections in the seeded history. Consider checking in on route load or recurring obstacles.`,
      severity: "info",
    });
  }

  // Rule 4: days with unusually high completed waste volume (> mean + 1 stddev)
  const dailyVolume = await pool.query(
    `SELECT scheduled_date, COALESCE(SUM(quantity_collected_kg),0) AS kg
     FROM collections WHERE status='COMPLETED' GROUP BY scheduled_date`
  );
  const volumes = dailyVolume.rows.map((r) => parseFloat(r.kg));
  if (volumes.length > 2) {
    const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const variance = volumes.reduce((a, b) => a + (b - mean) ** 2, 0) / volumes.length;
    const stddev = Math.sqrt(variance);
    const spikes = dailyVolume.rows.filter((r) => parseFloat(r.kg) > mean + stddev);
    if (spikes.length > 0) {
      const top = spikes.sort((a, b) => parseFloat(b.kg) - parseFloat(a.kg))[0];
      insights.push({
        id: "volume-spike",
        title: `Unusually high waste volume on ${new Date(top.scheduled_date).toLocaleDateString()}`,
        description: `${Math.round(parseFloat(top.kg))} kg was collected that day, above the average of ${Math.round(mean)} kg by more than one standard deviation. Worth checking for a one-off event or a data entry anomaly.`,
        severity: "info",
      });
    }
  }

  // Rule 5: open critical incidents older than 3 days — needs attention
  const staleIncidents = await pool.query(
    `SELECT COUNT(*)::int AS count FROM incidents
     WHERE status NOT IN ('RESOLVED','CLOSED') AND severity = 'CRITICAL' AND created_at < now() - interval '3 days'`
  );
  if (staleIncidents.rows[0].count > 0) {
    insights.push({
      id: "stale-critical-incidents",
      title: `${staleIncidents.rows[0].count} critical incident(s) open for over 3 days`,
      description: `These tickets have gone unresolved past a reasonable window for CRITICAL severity. Recommend escalating to HSE leadership.`,
      severity: "critical",
    });
  }

  res.json({
    generated_at: new Date().toISOString(),
    disclaimer: "These are rule-based recommendations computed from historical data, not AI predictions. Each insight states the rule that produced it.",
    insights,
  });
});

export default router;
