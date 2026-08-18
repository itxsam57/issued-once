BEGIN;

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  event_key text NOT NULL CHECK (event_key IN ('PAYMENT_RECEIVED','IN_PRODUCTION','SHIPPED','DELIVERED')),
  status text NOT NULL CHECK (status IN ('PENDING','SENT','FAILED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  provider_message_id text,
  failure_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  sent_at timestamptz,
  UNIQUE (issue_id, event_key)
);

CREATE TABLE IF NOT EXISTS support_requests (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  contact_id text NOT NULL REFERENCES verified_contacts(id),
  status text NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  payload_version smallint NOT NULL CHECK (payload_version = 1),
  key_version text NOT NULL CHECK (key_version = 'v1'),
  iv text NOT NULL,
  auth_tag text NOT NULL,
  ciphertext text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS support_requests_issue_created_idx
  ON support_requests (issue_id, created_at DESC);

COMMIT;
