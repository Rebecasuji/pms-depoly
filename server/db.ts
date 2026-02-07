// server/db.ts
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

// ✅ This matches the file you pasted (exports: users, employees, projects, projectTasks, taskMembers, etc.)
import * as schema from "../shared/schema.ts";

/* ================================
   Safety Check
================================ */
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in the .env file");
}

/* ================================
   PostgreSQL Pool (Neon)
================================ */
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },

  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 30_000,
  statement_timeout: 30_000,
});

/* ================================
   Pool Error Handler
================================ */
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

/* ================================
   Drizzle ORM Instance
================================ */
export const db = drizzle(pool, { schema });

/* ================================
   Database Health Check
================================ */
export async function checkDatabaseConnection() {
  try {
    console.log("🔌 Attempting database connection...");
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("✅ Database connection successful");
    return true;
  } catch (err: any) {
    console.error("❌ Database connection failed");
    console.error("Error:", err.message);
    console.error("Code:", err.code);
    return false;
  }
}
