BEGIN;

ALTER TABLE experience_answers
  DROP CONSTRAINT experience_answers_key_version_check;

ALTER TABLE experience_answers
  ADD CONSTRAINT experience_answers_key_version_check
  CHECK (key_version IN ('v1', 'v2'));

COMMIT;
