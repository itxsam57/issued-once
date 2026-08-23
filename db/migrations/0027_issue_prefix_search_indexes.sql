BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS issues_issue_code_trgm_idx
  ON issues USING gin (issue_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS issues_payment_provider_reference_trgm_idx
  ON issues USING gin (payment_provider_reference gin_trgm_ops)
  WHERE payment_provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS manufacturing_provider_order_trgm_idx
  ON manufacturing_jobs USING gin (provider_order_id gin_trgm_ops)
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS manufacturing_tracking_trgm_idx
  ON manufacturing_jobs USING gin (tracking_number gin_trgm_ops)
  WHERE tracking_number IS NOT NULL;

COMMIT;
