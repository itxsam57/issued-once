BEGIN;

CREATE TABLE IF NOT EXISTS question_definitions (
  question_id text NOT NULL,
  question_version smallint NOT NULL CHECK (question_version > 0),
  family text NOT NULL CHECK (family IN ('culture', 'place', 'rhythm', 'identity', 'music', 'boundary', 'wildcard')),
  prompt text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text', 'choice')),
  optional boolean NOT NULL DEFAULT false,
  choices jsonb,
  active boolean NOT NULL DEFAULT true,
  weight double precision NOT NULL DEFAULT 1 CHECK (weight > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (question_id, question_version)
);

CREATE TABLE IF NOT EXISTS experience_question_sets (
  experience_id text PRIMARY KEY REFERENCES experiences(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS experience_question_set_items (
  experience_id text NOT NULL REFERENCES experience_question_sets(experience_id) ON DELETE CASCADE,
  ordinal smallint NOT NULL CHECK (ordinal BETWEEN 1 AND 7),
  slot text NOT NULL CHECK (slot IN ('q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7')),
  question_id text NOT NULL,
  question_version smallint NOT NULL,
  family text NOT NULL CHECK (family IN ('culture', 'place', 'rhythm', 'identity', 'music', 'boundary', 'wildcard')),
  prompt_snapshot text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('text', 'choice')),
  optional boolean NOT NULL,
  choices_snapshot jsonb,
  PRIMARY KEY (experience_id, ordinal),
  UNIQUE (experience_id, slot),
  UNIQUE (experience_id, question_id),
  FOREIGN KEY (question_id, question_version)
    REFERENCES question_definitions(question_id, question_version)
);

CREATE INDEX IF NOT EXISTS experience_question_items_question_idx
  ON experience_question_set_items (question_id, question_version);

COMMIT;
