BEGIN;

ALTER TABLE ops_website_config_versions
  DROP CONSTRAINT IF EXISTS ops_website_config_versions_config_type_check;

ALTER TABLE ops_website_config_versions
  ADD CONSTRAINT ops_website_config_versions_config_type_check
  CHECK (config_type IN ('CATALOG','DESIGN_POLICY'));

CREATE TABLE IF NOT EXISTS issue_design_policy_overrides (
  issue_id uuid PRIMARY KEY REFERENCES issues(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE ops_design_candidates
  DROP CONSTRAINT IF EXISTS ops_design_candidates_source_check;

ALTER TABLE ops_design_candidates
  ADD CONSTRAINT ops_design_candidates_source_check
  CHECK (source IN ('AUTOMATIC','OWNER_REGENERATE','OWNER_REINTERPRET','OWNER_UPLOAD'));

COMMIT;
