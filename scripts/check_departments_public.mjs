import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

(async()=>{
  try {
    const env = dotenv.parse(fs.readFileSync('.env'));
    const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const sql = `select department from public.employees where public.employees.department IS NOT NULL AND public.employees.department != '' group by public.employees.department order by public.employees.department`;
    console.log('Running SQL (public.employees):', sql);
    const res = await pool.query(sql);
    console.log('Rows:', res.rows);
    await pool.end();
  } catch (err) {
    console.error('Error running public.employees query:', err);
    process.exit(1);
  }
})();
