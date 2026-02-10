import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

(async()=>{
  try {
    const env = dotenv.parse(fs.readFileSync('.env'));
    const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const r = await pool.query("select schemaname, tablename from pg_tables where tablename = 'employees'");
    console.log(r.rows);
    await pool.end();
  } catch (err) {
    console.error('Error checking pg_tables:', err);
    process.exit(1);
  }
})();
