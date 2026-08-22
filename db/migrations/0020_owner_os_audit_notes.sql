BEGIN;

CREATE TABLE IF NOT EXISTS ops_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL CHECK (actor_type = 'OWNER'),
  action_type text NOT NULL CHECK (length(action_type) BETWEEN 1 AND 120),
  issue_id uuid REFERENCES issues(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (length(target_type) BETWEEN 1 AND 80),
  target_id text NOT NULL CHECK (length(target_id) BETWEEN 1 AND 200),
  reason text,
  safe_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_audit_events_created_idx
  ON ops_audit_events (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ops_audit_events_issue_created_idx
  ON ops_audit_events (issue_id, created_at DESC, id DESC)
  WHERE issue_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ops_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_internal_notes_issue_created_idx
  ON ops_internal_notes (issue_id, created_at DESC, id DESC);

COMMIT;
