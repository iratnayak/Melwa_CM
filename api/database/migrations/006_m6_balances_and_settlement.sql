-- M6: balance calculation run history + indexes
BEGIN;

CREATE INDEX IF NOT EXISTS idx_ecb_employee_cycle
  ON employee_cycle_balances (employee_id, billing_cycle_id);

CREATE INDEX IF NOT EXISTS idx_ecb_cycle_overdue
  ON employee_cycle_balances (billing_cycle_id, is_overdue);

CREATE TABLE IF NOT EXISTS balance_calculation_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  triggered_by_user_id BIGINT REFERENCES users(id),
  mode VARCHAR(50) NOT NULL,
  employee_id BIGINT REFERENCES employees(id),
  billing_cycle_id BIGINT REFERENCES billing_cycles(id),
  reason TEXT,
  affected_rows INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_calc_runs_created
  ON balance_calculation_runs (created_at DESC);

COMMIT;

