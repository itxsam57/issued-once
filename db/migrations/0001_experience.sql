BEGIN;

CREATE TABLE IF NOT EXISTS experiences (
  id text PRIMARY KEY,
  public_session_hash text NOT NULL UNIQUE,
  stage text NOT NULL CHECK (
    stage IN (
      'VISITOR',
      'EXPERIENCE_STARTED',
      'QUESTION_1',
      'QUESTION_2',
      'QUESTION_3',
      'QUESTION_4',
      'QUESTION_5',
      'QUESTION_6',
      'QUESTION_7',
      'PROFILE_COMPLETE',
      'OBJECT_SELECTED',
      'SIZE_CONFIRMED',
      'CHECKOUT_STARTED'
    )
  ),
  hook_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT experiences_session_hash_sha256_hex
    CHECK (public_session_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS experiences_expires_at_idx
  ON experiences (expires_at);

CREATE INDEX IF NOT EXISTS experiences_stage_updated_at_idx
  ON experiences (stage, updated_at);

CREATE TABLE IF NOT EXISTS experience_answers (
  experience_id text NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  question_id text NOT NULL CHECK (question_id IN ('q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7')),
  payload_version smallint NOT NULL CHECK (payload_version = 1),
  key_version text NOT NULL CHECK (key_version = 'v1'),
  iv text NOT NULL,
  auth_tag text NOT NULL,
  ciphertext text NOT NULL,
  answered_at timestamptz NOT NULL,
  PRIMARY KEY (experience_id, question_id)
);

CREATE INDEX IF NOT EXISTS experience_answers_answered_at_idx
  ON experience_answers (answered_at);

COMMIT;
