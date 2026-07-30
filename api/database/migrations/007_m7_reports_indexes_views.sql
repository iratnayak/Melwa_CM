-- M7: reporting indexes + helper views (idempotent)
BEGIN;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_employee_txn_date
  ON credit_transactions (employee_id, txn_date);

CREATE INDEX IF NOT EXISTS idx_payments_employee_payment_date
  ON payments (employee_id, payment_date);

CREATE INDEX IF NOT EXISTS idx_ecb_cycle_employee
  ON employee_cycle_balances (billing_cycle_id, employee_id);

CREATE OR REPLACE VIEW vw_employee_ledger_entries AS
SELECT
  ct.employee_id,
  ct.txn_date AS entry_date,
  ct.created_at AS created_at,
  ct.id AS source_id,
  'credit_transaction'::text AS entry_type,
  ct.transaction_type AS reference,
  ct.description AS description,
  (CASE WHEN ct.transaction_type = 'reversal' THEN -ct.amount ELSE ct.amount END) AS delta_amount
FROM credit_transactions ct
UNION ALL
SELECT
  p.employee_id,
  p.payment_date AS entry_date,
  p.created_at AS created_at,
  p.id AS source_id,
  'payment'::text AS entry_type,
  p.method AS reference,
  p.reference_no AS description,
  (-1 * p.amount) AS delta_amount
FROM payments p
WHERE p.status <> 'reversed';

CREATE OR REPLACE VIEW vw_cycle_statement AS
SELECT
  ecb.id AS balance_id,
  ecb.employee_id,
  ecb.billing_cycle_id,
  e.employee_code,
  e.full_name,
  d.code AS department_code,
  d.name AS department_name,
  bc.cycle_code,
  bc.start_date,
  bc.end_date,
  bc.due_date,
  ecb.opening_balance,
  ecb.total_credit,
  ecb.total_paid,
  ecb.closing_balance,
  ecb.carried_forward_balance,
  ecb.advance_balance,
  ecb.is_overdue,
  ecb.calculated_at
FROM employee_cycle_balances ecb
JOIN employees e ON e.id = ecb.employee_id
JOIN departments d ON d.id = e.department_id
JOIN billing_cycles bc ON bc.id = ecb.billing_cycle_id;

COMMIT;

