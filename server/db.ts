import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/* ================================
   Safety Check
================================ */
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in the .env file");
}

/* ================================
   PostgreSQL Pool (Supabase)
================================ */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,                   // safe limit for Supabase pooler
  idleTimeoutMillis: 30000,  // close idle connections after 30s
  connectionTimeoutMillis: 5000,
});

/* ================================
   Pool Error Handler (Critical)
================================ */
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

/* ================================
   Drizzle ORM Instance
================================ */
export const db = drizzle(pool);
