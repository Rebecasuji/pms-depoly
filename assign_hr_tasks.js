
import 'dotenv/config';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
const { Client } = pg;

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });
    
    // IDs from previous steps
    const PUSHPA_ID = 'dcf8f955-b5fe-4225-a4d2-b8aedf61ba2f';
    const SAMYUKTHA_ID = 'd9de3fcf-f39d-4a6e-924b-aea210d06180';

    try {
        await client.connect();
        
        // Find HR projects
        const hrProjectsRes = await client.query(`
            SELECT project_id FROM project_departments 
            WHERE department ILIKE '%HR%' OR department ILIKE '%human%'
        `);
        const hrProjectIds = hrProjectsRes.rows.map(r => r.project_id);
        
        if (hrProjectIds.length === 0) {
            console.log("No HR projects found.");
            return;
        }

        // Find tasks in these projects
        const hrTasksRes = await client.query(`
            SELECT id, task_name FROM project_tasks 
            WHERE project_id = ANY($1)
        `, [hrProjectIds]);
        
        console.log(`Found ${hrTasksRes.rows.length} HR tasks.`);

        for (const task of hrTasksRes.rows) {
            console.log(`Assigning task: ${task.task_name} (${task.id})`);
            
            // Assign to Pushpa
            await client.query(`
                INSERT INTO task_members (task_id, employee_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [task.id, PUSHPA_ID]);
            
            // Assign to Samyuktha
            await client.query(`
                INSERT INTO task_members (task_id, employee_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [task.id, SAMYUKTHA_ID]);
        }
        
        console.log("Assignment complete.");
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
