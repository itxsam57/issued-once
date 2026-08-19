BEGIN;

CREATE TABLE IF NOT EXISTS ops_website_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type text NOT NULL CHECK (config_type IN ('CATALOG')),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  published_at timestamptz,
  UNIQUE (config_type, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS ops_website_config_active_type_idx
  ON ops_website_config_versions (config_type)
  WHERE status='ACTIVE';

CREATE INDEX IF NOT EXISTS ops_website_config_type_created_idx
  ON ops_website_config_versions (config_type, created_at DESC);

COMMIT;
