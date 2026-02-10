const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');

(async function() {
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
})();
