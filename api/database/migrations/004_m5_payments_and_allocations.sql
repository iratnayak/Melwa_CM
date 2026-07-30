-- M5: payments lifecycle + allocation ledger (idempotent)
BEGIN;

-- Ensure payments base table exists (for environments that skipped schema.sql)
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  billing_cycle_id BIGINT REFERENCES billing_cycles(id),
  received_by_user_id BIGINT NOT NULL REFERENCES users(id),
  payment_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(30) NOT NULL,
  reference_no VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'recorded';
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_status_check'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_status_check
      CHECK (status IN ('recorded', 'allocated', 'partially_allocated', 'reversed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_allocated_amount_check'
      AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_allocated_amount_check
      CHECK (allocated_amount >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_employee_created_at
  ON payments (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments (status);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  billing_cycle_id BIGINT NOT NULL REFERENCES billing_cycles(id),
  allocated_amount NUMERIC(14,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_id, billing_cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_employee_cycle
  ON payment_allocations (employee_id, billing_cycle_id);

COMMIT;
