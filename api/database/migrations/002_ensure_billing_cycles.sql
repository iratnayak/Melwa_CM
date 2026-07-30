-- M3: Ensure billing_cycles exists (idempotent)
BEGIN;

CREATE TABLE IF NOT EXISTS billing_cycles (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_code VARCHAR(30) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
