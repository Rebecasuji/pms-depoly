import "dotenv/config";
import { pool } from "./db.ts";

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log("📋 Available tables in database:");
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check projects table structure
    const projectsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'projects'
      ORDER BY ordinal_position
    `);
    
    console.log("\n🔍 Projects table structure:");
    projectsStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkTables();
