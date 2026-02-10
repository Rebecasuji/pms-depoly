import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

(async()=>{
  try {
    const env = dotenv.parse(fs.readFileSync('.env'));
    const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const sql = `select department from employees where employees.department IS NOT NULL AND employees.department != '' group by employees.department order by employees.department`;
    console.log('Running SQL (unquoted):', sql);
    const res = await pool.query(sql);
    console.log('Rows:', res.rows);
    await pool.end();
  } catch (err) {
    console.error('Error running unquoted departments query:', err);
    process.exit(1);
  }
})();
