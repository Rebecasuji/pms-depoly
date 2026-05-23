
import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT p.id as project_id, p.title as project_title, t.id as task_id, t.task_name, pd.department 
            FROM projects p 
            JOIN project_departments pd ON p.id = pd.project_id 
            JOIN project_tasks t ON p.id = t.project_id
            WHERE pd.department ILIKE '%HR%' OR pd.department ILIKE '%human%'
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
