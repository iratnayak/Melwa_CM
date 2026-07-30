-- Melwa Credit Management schema (PostgreSQL)

CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Stores hashed refresh token for rotation/revocation.
  current_refresh_token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE departments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE employees (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_code VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(200) NOT NULL,
  department_id BIGINT NOT NULL REFERENCES departments(id),
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE billing_cycles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_code VARCHAR(30) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE credit_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  billing_cycle_id BIGINT NOT NULL REFERENCES billing_cycles(id),
  entered_by_user_id BIGINT NOT NULL REFERENCES users(id),
  txn_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  -- Optional improvement: avoids deleting lines; use reversal/adjustment entries.
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'purchase'
    CHECK (transaction_type IN ('purchase', 'adjustment', 'reversal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  -- Optional: nullable when payment is recorded before cycle assignment.
  billing_cycle_id BIGINT REFERENCES billing_cycles(id),
  -- Cycle where overpayment was posted as advance_balance (may differ from billing_cycle_id).
  advance_applied_billing_cycle_id BIGINT REFERENCES billing_cycles(id),
  received_by_user_id BIGINT NOT NULL REFERENCES users(id),
  payment_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(30) NOT NULL,
  reference_no VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'recorded'
    CHECK (status IN ('recorded', 'allocated', 'partially_allocated', 'reversed')),
  allocated_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  allocated_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_allocations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  billing_cycle_id BIGINT NOT NULL REFERENCES billing_cycles(id),
  allocated_amount NUMERIC(14,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id, billing_cycle_id)
);

CREATE TABLE employee_cycle_balances (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  billing_cycle_id BIGINT NOT NULL REFERENCES billing_cycles(id),
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  carried_forward_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  advance_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, billing_cycle_id)
);

CREATE INDEX idx_ecb_employee_cycle
  ON employee_cycle_balances (employee_id, billing_cycle_id);

CREATE INDEX idx_ecb_cycle_overdue
  ON employee_cycle_balances (billing_cycle_id, is_overdue);

CREATE TABLE balance_calculation_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  triggered_by_user_id BIGINT REFERENCES users(id),
  mode VARCHAR(50) NOT NULL,
  employee_id BIGINT REFERENCES employees(id),
  billing_cycle_id BIGINT REFERENCES billing_cycles(id),
  reason TEXT,
  affected_rows INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sms_notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  -- Optional: nullable for non-cycle notifications in future.
  billing_cycle_id BIGINT REFERENCES billing_cycles(id),
  type VARCHAR(50) NOT NULL,
  message_body TEXT NOT NULL,
  phone_number VARCHAR(30) NOT NULL,
  provider VARCHAR(50),
  provider_message_id VARCHAR(100),
  status VARCHAR(30) NOT NULL,
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Optional: nullable for system-generated actions (workers/cron jobs).
  user_id BIGINT REFERENCES users(id),
  entity_name VARCHAR(100) NOT NULL,
  entity_id BIGINT NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Migration (EXISTING database only): employees.department (text) -> department_id
-- Run manually in order after backup. Skip on fresh installs (this file already final).
-- =============================================================================
--
-- 1) Create departments if not already present:
--    CREATE TABLE departments (...);  -- same as above
--
-- 2) Add FK column (nullable first for backfill):
--    ALTER TABLE employees ADD COLUMN department_id BIGINT REFERENCES departments(id);
--
-- 3) Seed departments from distinct legacy text (example):
--    INSERT INTO departments (code, name, is_active)
--    SELECT DISTINCT ON (trim(department))
--           upper(regexp_replace(trim(department), '[^A-Za-z0-9]+', '_', 'g')) AS code,
--           trim(department) AS name,
--           TRUE
--    FROM employees
--    WHERE department IS NOT NULL AND trim(department) <> ''
--    ON CONFLICT (code) DO NOTHING;
--
-- 4) Backfill employees.department_id (example join on name; adjust to your rules):
--    UPDATE employees e
--    SET department_id = d.id
--    FROM departments d
--    WHERE trim(e.department) = d.name;
--
-- 5) Enforce NOT NULL + drop legacy column:
--    ALTER TABLE employees ALTER COLUMN department_id SET NOT NULL;
--    ALTER TABLE employees DROP COLUMN department;
--
-- =============================================================================
