import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.TIMESTRAP_DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const rows = await pool.query(`SELECT DISTINCT employee_code, employee_name FROM time_entries WHERE employee_code IN ('E0046','E0048') ORDER BY employee_code`);
    console.log('EMP CODES', JSON.stringify(rows.rows, null, 2));

    const summary = await pool.query(`
      SELECT project_name, employee_code, employee_name, count(*) as cnt,
             sum(CAST(REGEXP_REPLACE(total_hours, '[^0-9\\.]+', '', 'g') AS numeric)) as sum_hours
      FROM time_entries
      WHERE employee_code IN ('E0046','E0048')
      GROUP BY project_name, employee_code, employee_name
      ORDER BY project_name, employee_code
    `);
    console.log('SUMMARY', JSON.stringify(summary.rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
})();
