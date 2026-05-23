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
        const res = await client.query("SELECT id, name FROM employees ORDER BY name");
        fs.writeFileSync("all_employees.json", JSON.stringify(res.rows, null, 2), "utf8");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
})();
