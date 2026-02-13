
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.oispfmpcveszivrzzyfy:Durgadevi@67@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    try {
        const res = await pool.query('SELECT id, name, department FROM employees WHERE department IS NOT NULL ORDER BY department');
        console.log('Employees with Departments:', res.rows);

        // Group by department
        const groups = {};
        res.rows.forEach(r => {
            const dept = r.department.trim();
            if (!groups[dept]) groups[dept] = 0;
            groups[dept]++;
        });
        console.log('Department Counts:', groups);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
