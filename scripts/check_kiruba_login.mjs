import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

(async()=>{
  let client;
  try {
    const env = dotenv.parse(fs.readFileSync('.env'));
    const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: false });
    client = await pool.connect();
    
    await client.query("SET search_path TO public, pg_catalog");
    
    // Find employee E0054 (KIRUBA)
    const empRes = await client.query(`
      SELECT id, name, emp_code, designation, department, email, phone 
      FROM employees 
      WHERE emp_code = 'E0054'
    `);
    console.log('=== Employee E0054 ===');
    console.log(empRes.rows);
    
    if (empRes.rows.length > 0) {
      const empId = empRes.rows[0].id;
      
      // Check if user exists for this employee
      const userRes = await client.query(`
        SELECT id, username, password, role, employee_id 
        FROM users 
        WHERE employee_id = $1
      `, [empId]);
      console.log('\n=== User for this employee ===');
      console.log(userRes.rows.length > 0 ? userRes.rows : 'No user found');
      
      if (userRes.rows.length === 0) {
        console.log('\n🔴 ISSUE: No user account linked to this employee!');
      }
    }
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
