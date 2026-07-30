-- M5: track billing cycle that received overpayment advance (for correct reversal)
BEGIN;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS advance_applied_billing_cycle_id BIGINT REFERENCES billing_cycles(id);

CREATE INDEX IF NOT EXISTS idx_payments_advance_applied_cycle
  ON payments (advance_applied_billing_cycle_id)
  WHERE advance_applied_billing_cycle_id IS NOT NULL;

COMMIT;
