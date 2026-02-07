BEGIN;

-- Remove existing sessions so any old tokens are invalidated
DELETE FROM sessions;

-- Optionally remove all existing users so only the allowed list can login
-- WARNING: this will delete all users. Uncomment if you want to fully replace users.
-- DELETE FROM users;

-- Ensure employees exist (no-op if emp_code already present)
-- Provide a default `department` value because some DBs add a NOT NULL
-- constraint on the employees.department column.
INSERT INTO employees (emp_code, name, department)
VALUES
  ('E0009','Employee E0009','General'),
  ('E0028','Employee E0028','General'),
  ('E0041','Employee E0041','General'),
  ('E0042','Employee E0042','General'),
  ('E0046','Employee E0046','General'),
  ('E0048','Employee E0048','General'),
  ('E0051','Employee E0051','General'),
  ('E0001','Employee E0001','General'),
  ('E0040','Employee E0040','General'),
  ('E0052','Employee E0052','General'),
  ('E0050','Employee E0050','General'),
  ('E0047','Employee E0047','General'),
  ('E0049','Employee E0049','General'),
  ('E0032','Employee E0032','General'),
  ('E0053','S.NAVEEN KUMAR','IT Support')
ON CONFLICT (emp_code) DO NOTHING;

-- Upsert users for allowed employee codes with password 'admin123'
-- NOTE: passwords are stored in plaintext here (as current app uses plaintext). Replace with hashed passwords if you enable bcrypt.

-- Helper: insert or update user for a given emp_code

-- E0001 will be ADMIN
INSERT INTO users (username, password, employee_id, role)
VALUES (
  'E0001',
  'admin123',
  (SELECT id FROM employees WHERE emp_code = 'E0001'),
  'ADMIN'
)
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, employee_id = EXCLUDED.employee_id, role = EXCLUDED.role;

-- Other allowed employees (EMPLOYEE role)
INSERT INTO users (username, password, employee_id, role)
VALUES
  ('E0009','admin123',(SELECT id FROM employees WHERE emp_code = 'E0009'),'EMPLOYEE'),
  ('E0028','admin123',(SELECT id FROM employees WHERE emp_code = 'E0028'),'EMPLOYEE'),
  ('E0041','admin123',(SELECT id FROM employees WHERE emp_code = 'E0041'),'EMPLOYEE'),
  ('E0042','admin123',(SELECT id FROM employees WHERE emp_code = 'E0042'),'EMPLOYEE'),
  ('E0046','admin123',(SELECT id FROM employees WHERE emp_code = 'E0046'),'EMPLOYEE'),
  ('E0048','admin123',(SELECT id FROM employees WHERE emp_code = 'E0048'),'EMPLOYEE'),
  ('E0051','admin123',(SELECT id FROM employees WHERE emp_code = 'E0051'),'EMPLOYEE'),
  ('E0040','admin123',(SELECT id FROM employees WHERE emp_code = 'E0040'),'EMPLOYEE'),
  ('E0052','admin123',(SELECT id FROM employees WHERE emp_code = 'E0052'),'EMPLOYEE'),
  ('E0050','admin123',(SELECT id FROM employees WHERE emp_code = 'E0050'),'EMPLOYEE'),
  ('E0047','admin123',(SELECT id FROM employees WHERE emp_code = 'E0047'),'EMPLOYEE'),
  ('E0049','admin123',(SELECT id FROM employees WHERE emp_code = 'E0049'),'EMPLOYEE'),
  ('E0032','admin123',(SELECT id FROM employees WHERE emp_code = 'E0032'),'EMPLOYEE'),
  ('E0053','admin123',(SELECT id FROM employees WHERE emp_code = 'E0053'),'EMPLOYEE')
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, employee_id = EXCLUDED.employee_id, role = EXCLUDED.role;

COMMIT;
