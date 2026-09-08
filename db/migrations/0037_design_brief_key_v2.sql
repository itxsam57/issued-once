BEGIN;

ALTER TABLE design_jobs
  DROP CONSTRAINT design_jobs_check;

ALTER TABLE design_jobs
  ADD CONSTRAINT design_jobs_check
  CHECK (
    (brief_payload_version IS NULL AND brief_key_version IS NULL AND brief_iv IS NULL AND brief_auth_tag IS NULL AND brief_ciphertext IS NULL)
    OR
    (brief_payload_version = 1 AND brief_key_version IN ('v1', 'v2') AND brief_iv IS NOT NULL AND brief_auth_tag IS NOT NULL AND brief_ciphertext IS NOT NULL)
  );

ALTER TABLE ops_design_candidates
  DROP CONSTRAINT ops_design_candidates_check;

ALTER TABLE ops_design_candidates
  ADD CONSTRAINT ops_design_candidates_check
  CHECK (
    (brief_payload_version IS NULL AND brief_key_version IS NULL AND brief_iv IS NULL AND brief_auth_tag IS NULL AND brief_ciphertext IS NULL)
    OR
    (brief_payload_version = 1 AND brief_key_version IN ('v1', 'v2') AND brief_iv IS NOT NULL AND brief_auth_tag IS NOT NULL AND brief_ciphertext IS NOT NULL)
  );

COMMIT;
