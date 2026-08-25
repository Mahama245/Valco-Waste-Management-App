import { pool } from "../db/pool";

// Atomically reserves the next number for a given counter and returns it.
// Uses UPDATE ... RETURNING inside a single statement, which Postgres
// executes atomically — two concurrent requests can never receive the same
// number, unlike the previous SELECT COUNT(*) + 1 approach.
async function nextCounterValue(counterKey: string): Promise<number> {
  const result = await pool.query(
    `INSERT INTO id_counters (counter_key, next_value) VALUES ($1, 2)
     ON CONFLICT (counter_key) DO UPDATE SET next_value = id_counters.next_value + 1
     RETURNING next_value - 1 AS reserved`,
    [counterKey]
  );
  return result.rows[0].reserved;
}

// Year is computed at generation time, not hardcoded, so identifiers roll
// over correctly at each new year without any code change.
function currentYear(): number {
  return new Date().getFullYear();
}

export async function nextCollectionCode(): Promise<string> {
  const n = await nextCounterValue("collection");
  return `WM-${currentYear()}-${String(n).padStart(6, "0")}`;
}

export async function nextIncidentCode(): Promise<string> {
  const n = await nextCounterValue("incident");
  return `INC-${currentYear()}-${String(10000 + n)}`;
}

export async function nextComplaintCode(): Promise<string> {
  const n = await nextCounterValue("complaint");
  return `CMP-${currentYear()}-${String(10000 + n)}`;
}

export async function nextRouteCode(): Promise<string> {
  const n = await nextCounterValue("route");
  return `RT-${currentYear()}-${String(n).padStart(3, "0")}`;
}

export async function nextBinCode(): Promise<string> {
  const n = await nextCounterValue("bin");
  return `WM-BIN-${String(10000 + n)}`;
}

export async function nextZoneCode(): Promise<string> {
  const n = await nextCounterValue("zone");
  return "Z" + String(n).padStart(3, "0");
}
