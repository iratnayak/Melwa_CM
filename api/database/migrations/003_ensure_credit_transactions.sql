-- M4: Ensure credit_transactions exists (idempotent)
BEGIN;

CREATE TABLE IF NOT EXISTS credit_transactions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  billing_cycle_id BIGINT NOT NULL REFERENCES billing_cycles(id),
  entered_by_user_id BIGINT NOT NULL REFERENCES users(id),
  txn_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'purchase'
    CHECK (transaction_type IN ('purchase', 'adjustment', 'reversal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
