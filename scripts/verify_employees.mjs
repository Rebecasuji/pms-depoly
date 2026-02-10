import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

(async()=>{
  let client;
  try {
    const env = dotenv.parse(fs.readFileSync('.env'));
    const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    client = await pool.connect();
    
    // Check search_path first
    const search = await client.query('SHOW search_path');
    console.log('=== Search Path ===');
    console.log(search.rows);
    
    // Check table structure
    const cols = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name='employees' ORDER BY ordinal_position
    `);
    console.log('\n=== Employees Table Columns ===');
    console.log(cols.rows);
    
    // Check employee count and departments
    const stats = await client.query(`
      SELECT COUNT(*) as count, COUNT(DISTINCT department) as dept_count 
      FROM employees
    `);
    console.log('\n=== Employee Stats ===');
    console.log(stats.rows);
    
    // Check unique departments
    const depts = await client.query(`
      SELECT DISTINCT department FROM employees 
      WHERE department IS NOT NULL AND department != '' 
      ORDER BY department
    `);
    console.log('\n=== Departments ===');
    console.log(depts.rows);
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
