-- 0008_add_task_assignees.sql
-- Add created_by_employee_id to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS created_by_employee_id uuid;

-- Create subtask_members mapping table for many-to-many assignees
CREATE TABLE IF NOT EXISTS subtask_members (
  subtask_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  PRIMARY KEY (subtask_id, employee_id)
);

-- Optional: create foreign key constraints if employees and subtasks tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subtasks') AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
    BEGIN
      ALTER TABLE subtask_members
        ADD CONSTRAINT fk_subtask_members_subtask FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      -- skip
    END;

    BEGIN
      ALTER TABLE subtask_members
        ADD CONSTRAINT fk_subtask_members_employee FOREIGN KEY (employee_id) REFERENCES employees(id);
    EXCEPTION WHEN duplicate_object THEN
      -- skip
    END;
  END IF;
END$$;
