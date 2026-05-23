import { pool } from "./db.ts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const sqlPath = path.join(__dirname, "seed_allowed_users.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = await pool.connect();
  try {
    console.log("Running seed script...");

    // Ensure sessions table exists before we attempt to DELETE FROM it in the seed.
    try {
      await client.query("SELECT 1 FROM sessions LIMIT 1");
    } catch (err: any) {
      const msg = err && (err.message || err.toString());
      if (err && err.code === '42P01' || /does not exist/i.test(msg)) {
        console.log("Sessions table missing — creating sessions table...");
        // Create a lightweight sessions table without strict FK constraints to
        // avoid type-mismatch errors with existing schemas (some installs use
        // varchar/text for user IDs). Using text columns keeps this idempotent
        // across environments.
        await client.query(`
          CREATE TABLE IF NOT EXISTS sessions (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            token text NOT NULL UNIQUE,
            user_id text,
            employee_id text,
            emp_code text,
            role text,
            created_at timestamp DEFAULT now(),
            expires_at timestamp
          );
        `);
        console.log("Created sessions table.");
      } else {
        throw err;
      }
    }

    await client.query(sql);
    console.log("Seed completed.");
  } catch (err) {
    console.error("Seed failed:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
