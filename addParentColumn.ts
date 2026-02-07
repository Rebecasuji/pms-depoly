import "dotenv/config";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addMissingColumns() {
  try {
    // Check and add parent_key_step_id to key_steps
    const col1 = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='key_steps' AND column_name='parent_key_step_id'
      );
    `);
    
    if (!col1.rows[0].exists) {
      await pool.query(`
        ALTER TABLE key_steps ADD COLUMN parent_key_step_id uuid;
      `);
      console.log('✓ Column parent_key_step_id added to key_steps');
    } else {
      console.log('✓ Column parent_key_step_id already exists in key_steps');
    }

    // Check and add assigned_to to subtasks
    const col2 = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='subtasks' AND column_name='assigned_to'
      );
    `);
    
    if (!col2.rows[0].exists) {
      await pool.query(`
        ALTER TABLE subtasks ADD COLUMN assigned_to uuid;
      `);
      console.log('✓ Column assigned_to added to subtasks');
    } else {
      console.log('✓ Column assigned_to already exists in subtasks');
    }

    // Check and add foreign key constraint if not exists
    const fk = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name='subtasks' AND constraint_name='subtasks_task_id_fkey'
      );
    `);
    
    if (!fk.rows[0].exists) {
      await pool.query(`
        ALTER TABLE subtasks 
        ADD CONSTRAINT subtasks_task_id_fkey 
        FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE;
      `);
      console.log('✓ Foreign key constraint added to subtasks');
    } else {
      // Check if FK points to the right table
      const fkCheck = await pool.query(`
        SELECT
          ccu.table_name AS foreign_table_name
        FROM
          information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name='subtasks' 
          AND tc.constraint_name='subtasks_task_id_fkey'
          AND tc.constraint_type='FOREIGN KEY'
        LIMIT 1;
      `);

      if (fkCheck.rows[0]?.foreign_table_name === 'project_tasks') {
        console.log('✓ Foreign key constraint already exists and points to project_tasks');
      } else {
        console.log('⚠ Foreign key exists but points to wrong table, recreating...');
        // Drop and recreate
        await pool.query(`
          ALTER TABLE subtasks 
          DROP CONSTRAINT subtasks_task_id_fkey;
        `);
        await pool.query(`
          ALTER TABLE subtasks 
          ADD CONSTRAINT subtasks_task_id_fkey 
          FOREIGN KEY (task_id) REFERENCES project_tasks(id) ON DELETE CASCADE;
        `);
        console.log('✓ Foreign key constraint fixed to point to project_tasks');
      }
    }
    
    await pool.end();
    console.log('\n✅ All missing columns have been added successfully!');
  } catch (err) {
    console.error('Error:', err);
    await pool.end();
    process.exit(1);
  }
}

addMissingColumns();
