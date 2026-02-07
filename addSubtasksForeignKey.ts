import { drizzle } from "drizzle-orm/neon-http";
import { http } from "http";

const db = drizzle(process.env.DATABASE_URL!);

async function addForeignKeyIfNotExists() {
  try {
    console.log("Checking if foreign key constraint exists...");
    
    // Try to add the constraint - if it exists, PostgreSQL will error, and we'll catch it
    await db.execute(`
      ALTER TABLE "subtasks" 
      ADD CONSTRAINT "subtasks_task_id_fkey" 
      FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE;
    `);
    
    console.log("✅ Foreign key constraint added successfully");
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      console.log("✅ Foreign key constraint already exists");
    } else {
      console.error("❌ Error:", err.message);
      throw err;
    }
  }
}

addForeignKeyIfNotExists();
