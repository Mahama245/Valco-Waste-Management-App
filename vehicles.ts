// Phase 3 demo data: builds routes out of today's + tomorrow's existing collections.
import { pool } from "./pool";

async function main() {
  console.log("Seeding Phase 3 demo data (routes)...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE route_stops, routes RESTART IDENTITY CASCADE");

    const collectors = (await client.query("SELECT id, full_name FROM users WHERE role = 'COLLECTOR' LIMIT 12")).rows;
    const vehicles = (await client.query("SELECT id FROM vehicles")).rows;
    const supervisor = (await client.query("SELECT id FROM users WHERE role = 'SUPERVISOR' LIMIT 1")).rows[0];

    let routeCount = 0;
    for (const collector of collectors) {
      // Find this collector's collections for today/tomorrow to build a route from
      const collections = (
        await client.query(
          `SELECT id FROM collections WHERE collector_id = $1 AND scheduled_date >= CURRENT_DATE
           AND scheduled_date <= CURRENT_DATE + interval '1 day' ORDER BY scheduled_date, id LIMIT 6`,
          [collector.id]
        )
      ).rows;
      if (collections.length === 0) continue;

      routeCount++;
      const code = `RT-2026-${String(routeCount).padStart(3, "0")}`;
      const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
      const distance = Math.round((5 + Math.random() * 25) * 10) / 10;
      const duration = Math.round(distance * (3 + Math.random() * 2));

      const routeRes = await client.query(
        `INSERT INTO routes (route_code, name, collector_id, vehicle_id, scheduled_date, estimated_distance_km, estimated_duration_min, status, created_by)
         VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,'PLANNED',$7) RETURNING id`,
        [code, `${collector.full_name}'s Route`, collector.id, vehicle.id, distance, duration, supervisor?.id ?? null]
      );
      const routeId = routeRes.rows[0].id;

      for (let i = 0; i < collections.length; i++) {
        const status = i === 0 ? "COMPLETED" : "PENDING"; // simulate first stop already done
        await client.query(
          `INSERT INTO route_stops (route_id, collection_id, stop_order, status, arrived_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [routeId, collections[i].id, i + 1, status, status === "COMPLETED" ? new Date() : null]
        );
      }
    }

    await client.query("COMMIT");
    console.log(`Created ${routeCount} routes with stops for today.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Phase 3 seed failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
