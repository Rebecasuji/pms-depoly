
import { pool } from "./server/db";

async function applyProgressChanges() {
    const client = await pool.connect();
    try {
        console.log("Adding progress columns...");

        // Add progress to key_steps if it doesn't exist
        await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='key_steps' AND column_name='progress') THEN
          ALTER TABLE key_steps ADD COLUMN progress INTEGER DEFAULT 0 NOT NULL;
        END IF;
      END $$;
    `);

        // Add progress to project_tasks if it doesn't exist
        await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_tasks' AND column_name='progress') THEN
          ALTER TABLE project_tasks ADD COLUMN progress INTEGER DEFAULT 0 NOT NULL;
        END IF;
      END $$;
    `);

        // Add progress to subtasks if it doesn't exist
        await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subtasks' AND column_name='progress') THEN
          ALTER TABLE subtasks ADD COLUMN progress INTEGER DEFAULT 0 NOT NULL;
        END IF;
      END $$;
    `);

        console.log("Creating progress_logs table...");
        await client.query(`
      CREATE TABLE IF NOT EXISTS progress_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID,
        key_step_id UUID,
        task_id UUID,
        subtask_id UUID,
        percentage INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by UUID
      );
    `);

        console.log("Database schema updated successfully!");
    } catch (err) {
        console.error("Error updating schema:", err);
    } finally {
        client.release();
        process.exit();
    }
}

applyProgressChanges();
