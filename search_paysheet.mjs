import { config } from 'dotenv';
import { Pool } from 'pg';
import { readFileSync } from 'fs';

// load .env
try { config(); } catch (e) { }

// fallback: parse .env manually if dotenv didn't pick it up
try {
    const env = readFileSync('.env', 'utf8');
    const match = env.match(/DATABASE_URL=(.+)/);
    if (match && !process.env.DATABASE_URL) {
        process.env.DATABASE_URL = match[1].trim();
    }
} catch (e) { }

if (!process.env.DATABASE_URL) {
    console.error('❌ No DATABASE_URL found');
    process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function search() {
    const client = await pool.connect();
    try {
        const keyword = '%paysheet%';

        // Search projects
        const proj = await client.query(`SELECT id, title, status FROM projects WHERE LOWER(title) LIKE $1 LIMIT 10`, [keyword]);
        console.log(`\n📁 PROJECTS (${proj.rowCount} found):`);
        proj.rows.forEach(r => console.log(`  id=${r.id} | "${r.title}" | ${r.status}`));

        // Search key steps
        const ks = await client.query(`SELECT id, name, status, "projectId" FROM keysteps WHERE LOWER(name) LIKE $1 LIMIT 10`, [keyword]);
        console.log(`\n🔑 KEY STEPS (${ks.rowCount} found):`);
        ks.rows.forEach(r => console.log(`  id=${r.id} | "${r.name}" | ${r.status} | projectId=${r.projectId}`));

        // Search tasks
        const tasks = await client.query(`SELECT id, "taskName", status, "projectId" FROM tasks WHERE LOWER("taskName") LIKE $1 LIMIT 10`, [keyword]);
        console.log(`\n✅ TASKS (${tasks.rowCount} found):`);
        tasks.rows.forEach(r => console.log(`  id=${r.id} | "${r.taskName}" | ${r.status} | projectId=${r.projectId}`));

        // Search subtasks
        const sub = await client.query(`SELECT id, title, "taskId" FROM subtasks WHERE LOWER(title) LIKE $1 LIMIT 10`, [keyword]);
        console.log(`\n📌 SUBTASKS (${sub.rowCount} found):`);
        sub.rows.forEach(r => console.log(`  id=${r.id} | "${r.title}" | taskId=${r.taskId}`));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

search();
