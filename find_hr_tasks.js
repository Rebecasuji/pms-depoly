import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        const client = await pool.connect();
        await client.query("SET search_path TO public");

        // 1. Find employees
        const empRes = await client.query("SELECT id, name FROM employees WHERE name ILIKE $1 OR name ILIKE $2", ['%Pushpa%', '%Samyutha%']);
        const employeesFound = empRes.rows;

        // 2. Identify HR projects
        const hrProjectsPipe = await client.query(`
            SELECT p.id, p.title 
            FROM projects p
            LEFT JOIN project_departments pd ON p.id = pd.project_id
            WHERE (pd.department ILIKE '%HR%' OR p.title ILIKE '%Hiring%' OR p.title ILIKE '%Talent%' OR p.title ILIKE '%Employee%' OR p.title ILIKE '%HR%')
            AND p.status NOT IN ('Completed', 'completed', 'Closed', 'closed')
        `);
        const hrProjectIds = hrProjectsPipe.rows.map(r => r.id);

        let unassignedHrTasks = [];
        if (hrProjectIds.length > 0) {
            const taskRes = await client.query(`
                SELECT pt.id, pt.task_name, p.title as project_title
                FROM project_tasks pt
                JOIN projects p ON pt.project_id = p.id
                WHERE pt.project_id = ANY($1)
                AND pt.id NOT IN (SELECT task_id FROM task_members)
                AND pt.status NOT IN ('Completed', 'completed', 'Closed', 'closed')
            `, [hrProjectIds]);
            unassignedHrTasks = taskRes.rows;
        }

        const result = {
            employees: employeesFound,
            tasks: unassignedHrTasks
        };

        fs.writeFileSync("hr_tasks_result.json", JSON.stringify(result, null, 2), "utf8");
        console.log("Done");

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
})();
