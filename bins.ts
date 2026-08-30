import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const isLocal = (process.env.DATABASE_URL || "").includes("localhost");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Managed Postgres providers (Neon, Render Postgres, Supabase, etc.) require
  // SSL. Skip it only for local development against a local database.
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});
