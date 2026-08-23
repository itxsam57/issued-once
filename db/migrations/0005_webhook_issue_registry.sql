BEGIN;

CREATE TABLE IF NOT EXISTS webhook_events (
  provider TEXT NOT NULL CHECK (provider = 'FOURTHWALL'),
  provider_event_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  api_version TEXT NOT NULL,
  test_mode BOOLEAN NOT NULL,
  provider_created_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  processing_status TEXT NOT NULL CHECK (
    processing_status IN (
      'RECEIVED',
      'PROCESSING',
      'PROCESSED',
      'FAILED_RETRYABLE',
      'FAILED_TERMINAL',
      'IGNORED_TEST'
    )
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  processed_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_detail TEXT,
  PRIMARY KEY (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS webhook_events_status_received_idx
  ON webhook_events (processing_status, received_at);

CREATE INDEX IF NOT EXISTS webhook_events_shop_created_idx
  ON webhook_events (shop_id, provider_created_at);

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_code TEXT NOT NULL UNIQUE CHECK (
    issue_code ~ '^IO-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'
  ),
  status TEXT NOT NULL CHECK (status IN ('RESERVED')),
  fourthwall_order_id TEXT NOT NULL UNIQUE,
  fourthwall_event_id TEXT NOT NULL UNIQUE,
  quote_id TEXT NOT NULL UNIQUE REFERENCES checkout_quotes(id),
  product_slug TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  size_code TEXT NOT NULL,
  color_code TEXT NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS issues_status_reserved_idx
  ON issues (status, reserved_at);

COMMIT;
