
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function patch() {
    const client = await pool.connect();
    try {
        console.log("Checking for missing columns in 'projects' table...");

        // Add company
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS company text;`);
        console.log("Checked/Added 'company' column");

        // Add location
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS location text;`);
        console.log("Checked/Added 'location' column");

        // Add created_by_employee_id
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_employee_id uuid;`);
        console.log("Checked/Added 'created_by_employee_id' column");

        // Add updated_at
        await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();`);
        console.log("Checked/Added 'updated_at' column");

        console.log("✅ Database patch completed successfully");
    } catch (err) {
        console.error("❌ Database patch failed:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

patch();
