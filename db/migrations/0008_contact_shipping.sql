BEGIN;

CREATE TABLE IF NOT EXISTS otp_challenges (
  id text PRIMARY KEY,
  experience_id text NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  email_hash text NOT NULL CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  email_payload_version smallint NOT NULL CHECK (email_payload_version = 1),
  email_key_version text NOT NULL CHECK (email_key_version = 'v1'),
  email_iv text NOT NULL,
  email_auth_tag text NOT NULL,
  email_ciphertext text NOT NULL,
  ip_hash text NOT NULL CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  resend_available_at timestamptz NOT NULL,
  attempts_remaining smallint NOT NULL CHECK (attempts_remaining BETWEEN 0 AND 5),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS otp_challenges_experience_email_idx
  ON otp_challenges (experience_id, email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS otp_challenges_ip_created_idx
  ON otp_challenges (ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS verified_contacts (
  id text PRIMARY KEY,
  experience_id text NOT NULL UNIQUE REFERENCES experiences(id) ON DELETE CASCADE,
  email_hash text NOT NULL CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  payload_version smallint NOT NULL CHECK (payload_version = 1),
  key_version text NOT NULL CHECK (key_version = 'v1'),
  iv text NOT NULL,
  auth_tag text NOT NULL,
  ciphertext text NOT NULL,
  verified_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS verified_contacts_email_hash_idx
  ON verified_contacts (email_hash);

CREATE TABLE IF NOT EXISTS shipping_snapshots (
  id text PRIMARY KEY,
  experience_id text NOT NULL UNIQUE REFERENCES experiences(id) ON DELETE CASCADE,
  contact_id text NOT NULL REFERENCES verified_contacts(id),
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  region_code text,
  postal_prefix text,
  payload_version smallint NOT NULL CHECK (payload_version = 1),
  key_version text NOT NULL CHECK (key_version = 'v1'),
  iv text NOT NULL,
  auth_tag text NOT NULL,
  ciphertext text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

COMMIT;
