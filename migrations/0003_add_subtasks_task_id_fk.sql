-- Add foreign key constraint from subtasks.task_id to project_tasks.id with ON DELETE CASCADE
-- First drop the old constraint if it exists (using IF EXISTS in PostgreSQL 9.2+)
ALTER TABLE "subtasks" 
ADD CONSTRAINT "subtasks_task_id_fkey" 
FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE;

