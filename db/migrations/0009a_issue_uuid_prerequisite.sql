BEGIN;

-- The legacy Fourthwall-era Issue registry used issue_code as its primary
-- identifier and did not have the internal UUID required by the final
-- payment/design/manufacturing identity spine. Add and backfill it before
-- migration 0010 introduces UUID foreign keys.
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS id uuid;

UPDATE issues
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE issues
  ALTER COLUMN id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS issues_internal_id_unique_idx
  ON issues (id);

COMMIT;
