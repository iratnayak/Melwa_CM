-- M2: departments + employees.department_id (idempotent, safe to re-run on dev DB)
-- Run from repo root or api folder:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/database/migrations/001_m2_departments_employee_department_fk.sql
--
-- Requires: existing public schema + employees table (legacy or new).

BEGIN;

-- 1) Departments table
CREATE TABLE IF NOT EXISTS departments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Default bucket for rows that cannot be mapped from legacy text
INSERT INTO departments (code, name, is_active)
VALUES ('UNASSIGNED', 'Unassigned', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 3) Add department_id if missing (nullable first for backfill)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'department_id'
  ) THEN
    ALTER TABLE employees
      ADD COLUMN department_id BIGINT REFERENCES departments(id);
  END IF;
END $$;

-- 4) Seed departments from legacy employees.department (varchar), if that column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'department'
  ) THEN
    INSERT INTO departments (code, name, is_active)
    SELECT DISTINCT ON (upper(regexp_replace(trim(department), '[^A-Za-z0-9]+', '_', 'g')))
           upper(regexp_replace(trim(department), '[^A-Za-z0-9]+', '_', 'g')) AS code,
           trim(department) AS name,
           TRUE
    FROM employees
    WHERE department IS NOT NULL
      AND trim(department) <> ''
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;

-- 5) Backfill department_id from legacy text (match on department name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'department'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'department_id'
  ) THEN
    UPDATE employees e
    SET department_id = d.id
    FROM departments d
    WHERE e.department_id IS NULL
      AND e.department IS NOT NULL
      AND trim(e.department) <> ''
      AND trim(e.department) = d.name;

    UPDATE employees e
    SET department_id = (SELECT id FROM departments WHERE code = 'UNASSIGNED' LIMIT 1)
    WHERE e.department_id IS NULL;
  END IF;
END $$;

-- 6) If department_id exists but still NULL (partial data), assign default
UPDATE employees e
SET department_id = (SELECT id FROM departments WHERE code = 'UNASSIGNED' LIMIT 1)
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'employees'
    AND c.column_name = 'department_id'
) AND e.department_id IS NULL;

-- 7) Enforce NOT NULL when column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'department_id'
  ) THEN
    ALTER TABLE employees ALTER COLUMN department_id SET NOT NULL;
  END IF;
END $$;

-- 8) Drop legacy text column if present
ALTER TABLE employees DROP COLUMN IF EXISTS department;

COMMIT;
