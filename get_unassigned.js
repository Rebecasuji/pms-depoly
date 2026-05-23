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

        // Projects with no members
        const unassignedProjects = await client.query(`
            SELECT title 
            FROM projects 
            WHERE id NOT IN (SELECT project_id FROM project_team_members)
            AND status NOT IN ('Completed', 'completed', 'Closed', 'closed')
        `);

        // Tasks with no members
        const unassignedTasks = await client.query(`
            SELECT task_name, (SELECT title FROM projects WHERE projects.id = project_tasks.project_id) as project_title
            FROM project_tasks 
            WHERE id NOT IN (SELECT task_id FROM task_members)
            AND status NOT IN ('Completed', 'completed', 'Closed', 'closed', 'Done', 'done')
        `);

        const result = {
            unassignedProjects: unassignedProjects.rows.map(r => r.title),
            unassignedTasks: unassignedTasks.rows.map(r => ({ taskName: r.task_name, projectTitle: r.project_title }))
        };

        fs.writeFileSync("unassigned_report.json", JSON.stringify(result, null, 2), "utf8");
        console.log("Report generated in unassigned_report.json");

    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        pool.end();
    }
})();
