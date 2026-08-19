BEGIN;

CREATE INDEX IF NOT EXISTS issues_paid_reserved_idx
  ON issues (reserved_at DESC, id DESC)
  WHERE payment_attempt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS issues_status_updated_idx
  ON issues (status, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS issues_payment_exception_updated_idx
  ON issues (updated_at DESC, id DESC)
  WHERE payment_exception_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_attempts_status_created_idx
  ON payment_attempts (status, created_at DESC, id);

CREATE INDEX IF NOT EXISTS design_jobs_state_updated_idx
  ON design_jobs (state, updated_at ASC, id);

CREATE INDEX IF NOT EXISTS manufacturing_jobs_state_updated_idx
  ON manufacturing_jobs (state, updated_at ASC, id);

CREATE INDEX IF NOT EXISTS notification_deliveries_status_updated_idx
  ON notification_deliveries (status, updated_at ASC, id);

CREATE INDEX IF NOT EXISTS support_requests_status_updated_idx
  ON support_requests (status, updated_at ASC, id);

CREATE INDEX IF NOT EXISTS issue_events_created_idx
  ON issue_events (created_at DESC, id DESC);

COMMIT;
