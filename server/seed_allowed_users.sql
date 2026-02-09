BEGIN;

-- Remove existing sessions so any old tokens are invalidated
DELETE FROM sessions;

-- Optionally remove all existing users so only the allowed list can login
-- WARNING: this will delete all users. Uncomment if you want to fully replace users.
-- DELETE FROM users;

-- Ensure employees exist with correct names
INSERT INTO employees (emp_code, name, department)
VALUES
  ('E0001','SAM','General'),
  ('E0009','RANJITH','General'),
  ('E0028','KAALIPUSHPA R','General'),
  ('E0032','SIVARAM C','General'),
  ('E0040','UMAR FAROOQUE','General'),
  ('E0041','MOHAN RAJ C','General'),
  ('E0042','YUVARAJ S','General'),
  ('E0046','Rebecasuji.A','General'),
  ('E0047','Samyuktha S','General'),
  ('E0048','DurgaDevi E','General'),
  ('E0049','P PUSHPA','General'),
  ('E0050','ZAMEELA BEGAM N','General'),
  ('E0051','ARUN KUMAR V','General'),
  ('E0052','D K JYOTHSNA PRIYA','General'),
  ('E0053','S.NAVEEN KUMAR','IT Support'),
  ('E0054','KIRUBA','Presales')
ON CONFLICT (emp_code) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department;

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
  ('E0053','admin123',(SELECT id FROM employees WHERE emp_code = 'E0053'),'EMPLOYEE'),
  ('E0054','admin123',(SELECT id FROM employees WHERE emp_code = 'E0054'),'EMPLOYEE')
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, employee_id = EXCLUDED.employee_id, role = EXCLUDED.role;

COMMIT;
