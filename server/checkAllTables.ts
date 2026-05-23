import "dotenv/config";
import { pool } from "./db.ts";

async function checkAllTables() {
  try {
    const tables = ['project_departments', 'project_team_members', 'project_vendors', 'project_files', 'employees'];
    
    for (const tableName of tables) {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = '${tableName}'
        ORDER BY ordinal_position
      `);
      
      console.log(`\n📊 ${tableName} table structure:`);
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

checkAllTables();
