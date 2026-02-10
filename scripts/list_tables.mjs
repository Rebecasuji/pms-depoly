import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

try {
  const env = dotenv.parse(fs.readFileSync('.env'));
  const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const res = await pool.query("select tablename from pg_tables where schemaname='public'");
  console.log(res.rows.map(r => r.tablename));
  await pool.end();
} catch (err) {
  console.error('Error listing tables:', err);
  process.exit(1);
}
