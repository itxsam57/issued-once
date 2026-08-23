BEGIN;

CREATE TABLE IF NOT EXISTS manufacturing_jobs (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
  design_job_id uuid NOT NULL REFERENCES design_jobs(id),
  state text NOT NULL CHECK (state IN ('RESERVED','DRAFT','IN_PRODUCTION','SHIPPED','DELIVERED','FAILED','CANCELED')),
  provider text NOT NULL CHECK (provider = 'PRINTFUL'),
  provider_order_id text,
  provider_status text,
  printful_variant_id integer,
  artwork_url text NOT NULL,
  failure_code text,
  tracking_number text,
  tracking_url text,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (provider, provider_order_id),
  CHECK (printful_variant_id IS NULL OR printful_variant_id > 0)
);

CREATE INDEX IF NOT EXISTS manufacturing_jobs_state_created_idx
  ON manufacturing_jobs (state, created_at);

CREATE TABLE IF NOT EXISTS manufacturing_provider_events (
  provider text NOT NULL CHECK (provider = 'PRINTFUL'),
  provider_event_id text NOT NULL,
  provider_order_id text,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL,
  PRIMARY KEY (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS manufacturing_provider_events_order_idx
  ON manufacturing_provider_events (provider, provider_order_id, received_at DESC);

COMMIT;
