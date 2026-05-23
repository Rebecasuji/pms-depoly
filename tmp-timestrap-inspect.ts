import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.TIMESTRAP_DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const rows = await pool.query(`SELECT DISTINCT project_name FROM time_entries WHERE employee_name IN ('Durga Devi','Rebeca','Rebecasuji.A','DurgaDevi E') ORDER BY project_name`);
    console.log('PROJECTS', rows.rows.map((r: any) => r.project_name));

    const summary = await pool.query(`
      SELECT project_name, employee_name, count(*) as cnt,
             sum(CAST(REGEXP_REPLACE(total_hours, '[^0-9\\.]+', '', 'g') AS numeric)) as sum_hours
      FROM time_entries
      WHERE employee_name IN ('Durga Devi','Rebeca','Rebecasuji.A','DurgaDevi E')
      GROUP BY project_name, employee_name
      ORDER BY project_name, employee_name
    `);
    console.log(JSON.stringify(summary.rows, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
})();
