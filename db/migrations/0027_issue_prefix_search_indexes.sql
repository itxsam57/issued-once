BEGIN;

CREATE INDEX IF NOT EXISTS issues_issue_code_lower_prefix_idx
  ON issues ((lower(issue_code)) text_pattern_ops);

CREATE INDEX IF NOT EXISTS issues_payment_provider_reference_lower_prefix_idx
  ON issues ((lower(payment_provider_reference)) text_pattern_ops)
  WHERE payment_provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS manufacturing_provider_order_lower_prefix_idx
  ON manufacturing_jobs ((lower(provider_order_id)) text_pattern_ops)
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS manufacturing_tracking_lower_prefix_idx
  ON manufacturing_jobs ((lower(tracking_number)) text_pattern_ops)
  WHERE tracking_number IS NOT NULL;

COMMIT;
