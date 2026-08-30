// Phase 2 demo data: smart bins, vehicle GPS positions, incidents, complaints, notifications.
// Coordinates are centered on Tema, Ghana (VALCO Smelters' real location) with random jitter.
import { pool } from "./pool";

const CENTER_LAT = 5.669;
const CENTER_LNG = 0.017;

function jitter(base: number, spread: number) {
  return Math.round((base + (Math.random() - 0.5) * spread) * 1e6) / 1e6;
}

const WASTE_TYPES = ["GENERAL", "PLASTIC", "PAPER", "METAL", "GLASS", "ORGANIC", "HAZARDOUS", "E_WASTE", "OTHER"];
const INCIDENT_CATEGORIES = [
  "OVERFLOWING_BIN", "MISSED_COLLECTION", "ILLEGAL_DUMPING", "DAMAGED_BIN", "HAZARDOUS_WASTE",
  "WASTE_SPILL", "BLOCKED_ACCESS", "VEHICLE_BREAKDOWN", "WORKER_SAFETY", "ENVIRONMENTAL", "OTHER",
];
const SEVERITIES = ["LOW", "MEDIUM", "MEDIUM", "HIGH", "CRITICAL"]; // weighted toward MEDIUM
const INCIDENT_STATUSES = ["NEW", "ASSIGNED", "INVESTIGATING", "RESOLVED", "CLOSED"];
const COMPLAINT_CATEGORIES = ["missed_collection", "overflowing_bin", "illegal_dumping", "damaged_bin", "other"];

async function main() {
  console.log("Seeding Phase 2 demo data (bins, fleet GPS, incidents, complaints, notifications)...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE bins, incidents, complaints, notifications RESTART IDENTITY CASCADE");

    const zones = (await client.query("SELECT id, name FROM zones")).rows;
    const vehicles = (await client.query("SELECT id FROM vehicles")).rows;
    const collectors = (await client.query("SELECT id FROM users WHERE role = 'COLLECTOR'")).rows;
    const drivers = (await client.query("SELECT id FROM users WHERE role = 'DRIVER'")).rows;
    const hseOfficers = (await client.query("SELECT id FROM users WHERE role = 'HSE_OFFICER'")).rows;
    const supervisors = (await client.query("SELECT id FROM users WHERE role = 'SUPERVISOR'")).rows;
    const residents = (await client.query("SELECT id FROM users WHERE role = 'RESIDENT'")).rows;
    const allStaff = [...collectors, ...supervisors, ...hseOfficers];

    // --- BINS: 55 across zones ---
    let binCount = 0;
    const binIds: number[] = [];
    for (let i = 1; i <= 55; i++) {
      binCount++;
      const zone = zones[Math.floor(Math.random() * zones.length)];
      const code = `WM-BIN-${String(10000 + binCount)}`;
      const fill = Math.round(Math.random() * 1000) / 10; // 0.0 - 100.0
      const status = fill >= 95 ? "CRITICAL" : fill >= 85 ? "NEAR_CAPACITY" : fill >= 70 ? "NEAR_CAPACITY" : "NORMAL";
      const wType = WASTE_TYPES[Math.floor(Math.random() * WASTE_TYPES.length)];
      const lat = jitter(CENTER_LAT, 0.04);
      const lng = jitter(CENTER_LNG, 0.04);
      const res = await client.query(
        `INSERT INTO bins (bin_code, zone_id, location, lat, lng, waste_type, capacity_liters, fill_level_pct, status, last_collected_at, next_scheduled_at)
         VALUES ($1,$2,$3,$4,$5,$6,1100,$7,$8, now() - interval '1 day' * (1 + random()*3), now() + interval '1 day' * (1 + random()*2))`,
        [code, zone.id, `Bin cluster, ${zone.name}`, lat, lng, wType, fill, status]
      );
      binIds.push(res.rows[0]?.id ?? binCount);
    }
    console.log(`Created ${binCount} bins.`);

    // --- VEHICLE GPS: give every vehicle a live-looking position + status ---
    const vStatuses = ["EN_ROUTE", "COLLECTING", "RETURNING", "AVAILABLE", "MAINTENANCE"];
    const fuelTypes = ["Diesel", "Diesel", "Diesel", "Electric"];
    for (const v of vehicles) {
      const status = vStatuses[Math.floor(Math.random() * vStatuses.length)];
      const driver = drivers[Math.floor(Math.random() * drivers.length)];
      await client.query(
        `UPDATE vehicles SET
           status = $1, capacity_kg = $2, fuel_type = $3, mileage_km = $4,
           insurance_expiry = CURRENT_DATE + interval '1 day' * (30 + floor(random()*300)),
           roadworthy_expiry = CURRENT_DATE + interval '1 day' * (10 + floor(random()*300)),
           maintenance_due = CURRENT_DATE + interval '1 day' * (floor(random()*45) - 5),
           driver_id = $5, current_lat = $6, current_lng = $7,
           speed_kmh = $8, trip_distance_km = $9, last_gps_update = now() - interval '1 minute' * floor(random()*5)
         WHERE id = $10`,
        [
          status, 3000 + Math.round(Math.random() * 7000), fuelTypes[Math.floor(Math.random() * fuelTypes.length)],
          Math.round(Math.random() * 120000) / 10,
          driver?.id ?? null, jitter(CENTER_LAT, 0.04), jitter(CENTER_LNG, 0.04),
          status === "EN_ROUTE" || status === "COLLECTING" ? Math.round(Math.random() * 60) : 0,
          Math.round(Math.random() * 800) / 10,
          v.id,
        ]
      );
    }
    console.log(`Updated GPS/fleet detail for ${vehicles.length} vehicles.`);

    // --- INCIDENTS: 30 tickets ---
    let incidentCount = 0;
    for (let i = 0; i < 30; i++) {
      incidentCount++;
      const zone = zones[Math.floor(Math.random() * zones.length)];
      const ticket = `INC-2026-${String(10000 + incidentCount)}`;
      const category = INCIDENT_CATEGORIES[Math.floor(Math.random() * INCIDENT_CATEGORIES.length)];
      const severity = SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)];
      const status = INCIDENT_STATUSES[Math.floor(Math.random() * INCIDENT_STATUSES.length)];
      const reporter = allStaff.length ? allStaff[Math.floor(Math.random() * allStaff.length)] : null;
      const officer = hseOfficers.length ? hseOfficers[Math.floor(Math.random() * hseOfficers.length)] : null;
      const isResolved = status === "RESOLVED" || status === "CLOSED";
      await client.query(
        `INSERT INTO incidents (ticket_number, reporter_id, zone_id, location, lat, lng, category, severity, description, assigned_officer_id, status, resolution, resolved_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now() - interval '1 day' * floor(random()*14))`,
        [
          ticket, reporter?.id ?? null, zone.id, `Near ${zone.name}`, jitter(CENTER_LAT, 0.04), jitter(CENTER_LNG, 0.04),
          category, severity, `${category.replace(/_/g, " ").toLowerCase()} reported near ${zone.name}. Needs review.`,
          status !== "NEW" ? officer?.id ?? null : null, status,
          isResolved ? "Issue addressed and area inspected." : null,
          isResolved ? new Date() : null,
        ]
      );
    }
    console.log(`Created ${incidentCount} incidents.`);

    // --- COMPLAINTS: from residents ---
    let complaintCount = 0;
    if (residents.length) {
      for (let i = 0; i < 15; i++) {
        complaintCount++;
        const tracking = `CMP-2026-${String(10000 + complaintCount)}`;
        const resident = residents[Math.floor(Math.random() * residents.length)];
        const category = COMPLAINT_CATEGORIES[Math.floor(Math.random() * COMPLAINT_CATEGORIES.length)];
        const statuses = ["SUBMITTED", "IN_REVIEW", "RESOLVED", "CLOSED"];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        await client.query(
          `INSERT INTO complaints (tracking_number, resident_id, category, location, description, status, response, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7, now() - interval '1 day' * floor(random()*10))`,
          [
            tracking, resident.id, category, "Estate Housing A, Block 4",
            `Resident reported: ${category.replace(/_/g, " ")}.`,
            status,
            status === "RESOLVED" || status === "CLOSED" ? "Waste team dispatched and issue resolved." : null,
          ]
        );
      }
    }
    console.log(`Created ${complaintCount} complaints.`);

    // --- NOTIFICATIONS: a handful per staff member ---
    let notifCount = 0;
    const notifTemplates = [
      { type: "bin_critical", title: "Bin approaching capacity", body: "A bin in your zone has reached critical fill level." },
      { type: "missed_collection", title: "Collection missed", body: "A scheduled collection was marked as missed." },
      { type: "incident_assigned", title: "Incident assigned to you", body: "A new incident ticket has been assigned to you for review." },
      { type: "maintenance_reminder", title: "Vehicle maintenance due", body: "A vehicle in the fleet has upcoming maintenance." },
    ];
    for (const staff of [...supervisors, ...hseOfficers]) {
      for (const t of notifTemplates) {
        notifCount++;
        await client.query(
          `INSERT INTO notifications (user_id, type, title, body, is_read, created_at)
           VALUES ($1,$2,$3,$4,$5, now() - interval '1 hour' * floor(random()*48))`,
          [staff.id, t.type, t.title, t.body, Math.random() > 0.5]
        );
      }
    }
    console.log(`Created ${notifCount} notifications.`);

    await client.query("COMMIT");
    console.log("\nPhase 2 seed complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Phase 2 seed failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
