
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.oispfmpcveszivrzzyfy:Durgadevi@67@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    try {
        const res = await pool.query('SELECT * FROM project_departments LIMIT 50');
        console.log('Project Departments:', res.rows);

        // Also check projects to correlate
        const projRes = await pool.query('SELECT id, title FROM projects LIMIT 50');
        console.log('Projects:', projRes.rows);

        // Join check
        const joinRes = await pool.query(`
      SELECT p.title, pd.department 
      FROM projects p 
      LEFT JOIN project_departments pd ON p.id = pd.project_id
    `);
        console.log('Projects with Departments:', joinRes.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
