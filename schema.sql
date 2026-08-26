// Seeds the database with DEMO DATA for presentation purposes.
// Run with: npm run seed
import bcrypt from "bcryptjs";
import { pool } from "./pool";

const ZONE_NAMES = [
  "Smelter Plant Area", "Administration Block", "Estate Housing A", "Estate Housing B",
  "Workshop & Maintenance Yard", "Warehouse & Stores", "Port Access Road", "Main Gate Area",
  "Carbon Plant Zone", "Potroom 1", "Potroom 2", "Cast House", "Rectifier Station",
  "Staff Clinic Area", "Sports Complex", "Guest House Zone", "Fuel Depot", "Scrap Yard",
  "Effluent Treatment Zone", "Perimeter Zone North", "Perimeter Zone South", "Canteen Block"
];

const FIRST_NAMES = ["Kwame", "Ama", "Kofi", "Efua", "Yaw", "Abena", "Kojo", "Akosua", "Kwabena", "Adjoa", "Kwaku", "Afia", "Yaa", "Fiifi", "Esi"];
const LAST_NAMES = ["Mensah", "Osei", "Boateng", "Owusu", "Asante", "Appiah", "Darko", "Agyeman", "Amoah", "Adjei"];

function randomName() {
  return `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
}

async function main() {
  console.log("Seeding VALCO Waste Management demo data...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Wipe existing demo data (safe for dev/demo only)
    await client.query("TRUNCATE audit_logs, collections, vehicles, users, zones RESTART IDENTITY CASCADE");

    // --- Zones ---
    const zoneIds: number[] = [];
    for (const name of ZONE_NAMES) {
      const code = "Z" + String(zoneIds.length + 1).padStart(3, "0");
      const res = await client.query(
        "INSERT INTO zones (name, code, description) VALUES ($1, $2, $3) RETURNING id",
        [name, code, `Waste collection zone covering ${name}.`]
      );
      zoneIds.push(res.rows[0].id);
    }
    console.log(`Created ${zoneIds.length} zones.`);

    // --- Users: one demo account per role, plus extra collectors/drivers/residents ---
    const passwordHash = await bcrypt.hash("Demo@2026", 10);

    const demoAccounts: { username: string; role: string; full_name: string; department?: string }[] = [
      { username: "superadmin", role: "SUPER_ADMIN", full_name: "Nana Boateng", department: "Executive" },
      { username: "ictadmin", role: "ICT_ADMIN", full_name: "Kwabena Owusu", department: "ICT" },
      { username: "wastemanager", role: "WASTE_MANAGER", full_name: "Ama Serwaa", department: "Waste Operations" },
      { username: "supervisor", role: "SUPERVISOR", full_name: "Yaw Frimpong", department: "Waste Operations" },
      { username: "hseofficer", role: "HSE_OFFICER", full_name: "Efua Asantewaa", department: "Environmental / HSE" },
      { username: "contractor1", role: "CONTRACTOR", full_name: "GreenCycle Ghana Ltd", department: "External Contractor" },
      { username: "resident1", role: "RESIDENT", full_name: "Kofi Adjei", department: "Estate Housing A" },
      { username: "management", role: "MANAGEMENT", full_name: "Dr. Abena Nyarko", department: "Executive" },
      { username: "mahama245", role: "SUPER_ADMIN", full_name: "Mahama", department: "ICT / Attachment" },
    ];

    const roleToUserId: Record<string, number[]> = {};

    for (const acc of demoAccounts) {
      const zoneId = zoneIds[Math.floor(Math.random() * zoneIds.length)];
      const res = await client.query(
        `INSERT INTO users (full_name, username, email, password_hash, role, department, zone_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [acc.full_name, acc.username, `${acc.username}@valco.demo`, passwordHash, acc.role, acc.department, zoneId]
      );
      roleToUserId[acc.role] = roleToUserId[acc.role] || [];
      roleToUserId[acc.role].push(res.rows[0].id);
    }

    // 10+ collectors, 8+ drivers
    for (let i = 1; i <= 12; i++) {
      const name = randomName();
      const username = `collector${i}`;
      const zoneId = zoneIds[Math.floor(Math.random() * zoneIds.length)];
      const res = await client.query(
        `INSERT INTO users (full_name, username, email, password_hash, role, department, zone_id)
         VALUES ($1, $2, $3, $4, 'COLLECTOR', 'Waste Operations', $5) RETURNING id`,
        [name, username, `${username}@valco.demo`, passwordHash, zoneId]
      );
      roleToUserId.COLLECTOR = roleToUserId.COLLECTOR || [];
      roleToUserId.COLLECTOR.push(res.rows[0].id);
    }
    for (let i = 1; i <= 8; i++) {
      const name = randomName();
      const username = `driver${i}`;
      await client.query(
        `INSERT INTO users (full_name, username, email, password_hash, role, department)
         VALUES ($1, $2, $3, $4, 'DRIVER', 'Fleet')`,
        [name, username, `${username}@valco.demo`, passwordHash]
      );
    }
    console.log(`Created ${demoAccounts.length + 12 + 8} demo user accounts (all use password: Demo@2026).`);

    // --- Vehicles ---
    const vehicleTypes = ["Compactor Truck", "Skip Loader", "Pickup Truck", "Tipper Truck"];
    const vehicleIds: number[] = [];
    for (let i = 1; i <= 8; i++) {
      const reg = `VS-${String(i).padStart(2, "0")}`;
      const type = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
      const res = await client.query(
        "INSERT INTO vehicles (registration_number, vehicle_type, status) VALUES ($1, $2, 'AVAILABLE') RETURNING id",
        [reg, type]
      );
      vehicleIds.push(res.rows[0].id);
    }
    console.log(`Created ${vehicleIds.length} vehicles.`);

    // --- Collections: historical + today + upcoming ---
    const wasteTypes = ["GENERAL", "PLASTIC", "PAPER", "METAL", "GLASS", "ORGANIC", "HAZARDOUS", "E_WASTE", "OTHER"];
    const priorities = ["LOW", "NORMAL", "NORMAL", "NORMAL", "HIGH"]; // weighted toward NORMAL
    const collectors = roleToUserId.COLLECTOR;
    const supervisorId = roleToUserId.SUPERVISOR[0];

    let collectionCount = 0;
    const today = new Date();

    for (let dayOffset = -14; dayOffset <= 3; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().slice(0, 10);

      const numCollectionsToday = 6 + Math.floor(Math.random() * 6); // 6-11 per day
      for (let i = 0; i < numCollectionsToday; i++) {
        collectionCount++;
        const code = `WM-2026-${String(collectionCount).padStart(6, "0")}`;
        const zoneId = zoneIds[Math.floor(Math.random() * zoneIds.length)];
        const collectorId = collectors[Math.floor(Math.random() * collectors.length)];
        const vehicleId = vehicleIds[Math.floor(Math.random() * vehicleIds.length)];
        const wType = wasteTypes[Math.floor(Math.random() * wasteTypes.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];

        let status = "PENDING";
        let actualPickup: string | null = null;
        let quantity: number | null = null;
        let missedReason: string | null = null;

        if (dayOffset < 0) {
          // past days: mostly completed, some missed
          const roll = Math.random();
          if (roll < 0.85) {
            status = "COMPLETED";
            actualPickup = `${dateStr}T${String(6 + Math.floor(Math.random() * 6)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00Z`;
            quantity = Math.round((50 + Math.random() * 950) * 100) / 100;
          } else {
            status = "MISSED";
            missedReason = ["Vehicle breakdown", "Access blocked", "Collector unavailable", "Bin inaccessible"][Math.floor(Math.random() * 4)];
          }
        } else if (dayOffset === 0) {
          const roll = Math.random();
          status = roll < 0.6 ? "COMPLETED" : roll < 0.85 ? "IN_PROGRESS" : "PENDING";
          if (status === "COMPLETED") {
            actualPickup = `${dateStr}T${String(6 + Math.floor(Math.random() * 4)).padStart(2, "0")}:00:00Z`;
            quantity = Math.round((50 + Math.random() * 950) * 100) / 100;
          }
        } else {
          status = "PENDING";
        }

        await client.query(
          `INSERT INTO collections
            (collection_code, zone_id, location, scheduled_date, scheduled_time, collector_id, vehicle_id,
             waste_type, priority, status, actual_pickup_time, quantity_collected_kg, missed_reason, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            code, zoneId, `Bin cluster near ${ZONE_NAMES[zoneId - 1] || "zone"}`, dateStr,
            `${String(6 + Math.floor(Math.random() * 6)).padStart(2, "0")}:00`,
            collectorId, vehicleId, wType, priority, status, actualPickup, quantity, missedReason, supervisorId
          ]
        );
      }
    }
    console.log(`Created ${collectionCount} collections spanning the last 14 days through the next 3 days.`);

    // --- Sample audit log entries ---
    await client.query(
      `INSERT INTO audit_logs (user_id, action, record_type, record_id, description)
       VALUES
       ($1, 'UPDATE', 'collection', 1, 'Supervisor changed collection WM-2026-000001 from Pending to Completed.'),
       ($1, 'CREATE', 'user', NULL, 'ICT Admin created a new collector account.'),
       ($1, 'LOGIN', 'user', NULL, 'Super Admin logged in.')`,
      [supervisorId]
    );

    await client.query("COMMIT");
    console.log("\nSeed complete. Demo login credentials (all use password Demo@2026):");
    for (const acc of demoAccounts) {
      console.log(`  ${acc.role.padEnd(14)} -> username: ${acc.username}`);
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
