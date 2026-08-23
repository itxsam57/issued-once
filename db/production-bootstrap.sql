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

CREATE TABLE IF NOT EXISTS checkout_quotes (
  id text PRIMARY KEY,
  experience_id text NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  product_slug text NOT NULL,
  variant_id text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checkout_quotes_experience_expires_idx
  ON checkout_quotes (experience_id, expires_at);

CREATE INDEX IF NOT EXISTS checkout_quotes_expires_at_idx
  ON checkout_quotes (expires_at);

CREATE TABLE IF NOT EXISTS experience_physical_selection (
  experience_id TEXT PRIMARY KEY REFERENCES experiences(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL CHECK (object_type IN ('tee', 'hoodie', 'hat')),
  product_slug TEXT NOT NULL,
  size_code TEXT,
  color_code TEXT,
  color_label TEXT,
  color_swatch TEXT,
  variant_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS experience_physical_selection_product_idx
  ON experience_physical_selection (product_slug);

ALTER TABLE experiences
  DROP CONSTRAINT IF EXISTS experiences_stage_check;

ALTER TABLE experiences
  ADD CONSTRAINT experiences_stage_check
  CHECK (
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
      'COMMITMENT_READY',
      'CHECKOUT_STARTED'
    )
  );

CREATE TABLE IF NOT EXISTS webhook_events (
  provider TEXT NOT NULL CHECK (provider = 'FOURTHWALL'),
  provider_event_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  api_version TEXT NOT NULL,
  test_mode BOOLEAN NOT NULL,
  provider_created_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  processing_status TEXT NOT NULL CHECK (
    processing_status IN (
      'RECEIVED',
      'PROCESSING',
      'PROCESSED',
      'FAILED_RETRYABLE',
      'FAILED_TERMINAL',
      'IGNORED_TEST'
    )
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  processed_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_detail TEXT,
  PRIMARY KEY (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS webhook_events_status_received_idx
  ON webhook_events (processing_status, received_at);

CREATE INDEX IF NOT EXISTS webhook_events_shop_created_idx
  ON webhook_events (shop_id, provider_created_at);

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_code TEXT NOT NULL UNIQUE CHECK (
    issue_code ~ '^IO-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'
  ),
  status TEXT NOT NULL CHECK (status IN ('RESERVED')),
  fourthwall_order_id TEXT NOT NULL UNIQUE,
  fourthwall_event_id TEXT NOT NULL UNIQUE,
  quote_id TEXT NOT NULL UNIQUE REFERENCES checkout_quotes(id),
  product_slug TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  size_code TEXT NOT NULL,
  color_code TEXT NOT NULL,
  reserved_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS issues_status_reserved_idx
  ON issues (status, reserved_at);

ALTER TABLE experience_physical_selection
  DROP CONSTRAINT IF EXISTS experience_physical_selection_object_type_check;

ALTER TABLE experience_physical_selection
  ADD CONSTRAINT experience_physical_selection_object_type_check
  CHECK (object_type IN ('tee', 'hoodie', 'hat', 'tote'));

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

CREATE TABLE IF NOT EXISTS payment_attempts (
  id text PRIMARY KEY,
  experience_id text NOT NULL REFERENCES experiences(id),
  quote_id text NOT NULL REFERENCES checkout_quotes(id),
  contact_id text NOT NULL REFERENCES verified_contacts(id),
  shipping_snapshot_id text NOT NULL REFERENCES shipping_snapshots(id),
  provider text NOT NULL CHECK (provider IN ('SAFEPAY')),
  provider_reference text,
  checkout_url text,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('CREATED','REDIRECTED','PAID','FAILED','REFUNDED','EXCEPTION')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (provider, provider_reference)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_active_quote_idx
  ON payment_attempts (experience_id, quote_id)
  WHERE status IN ('CREATED','REDIRECTED','PAID');

CREATE INDEX IF NOT EXISTS payment_attempts_experience_idx
  ON payment_attempts (experience_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_provider_events (
  provider text NOT NULL CHECK (provider IN ('SAFEPAY')),
  provider_event_id text NOT NULL,
  provider_reference text NOT NULL,
  state text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  reference text,
  received_at timestamptz NOT NULL,
  PRIMARY KEY (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS payment_provider_events_reference_idx
  ON payment_provider_events (provider, provider_reference, received_at DESC);

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS id uuid;

UPDATE issues
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE issues
  ALTER COLUMN id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS issues_internal_id_unique_idx
  ON issues (id);

ALTER TABLE issues
  ALTER COLUMN fourthwall_order_id DROP NOT NULL,
  ALTER COLUMN fourthwall_event_id DROP NOT NULL;

ALTER TABLE issues
  DROP CONSTRAINT IF EXISTS issues_status_check;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS payment_attempt_id text REFERENCES payment_attempts(id),
  ADD COLUMN IF NOT EXISTS experience_id text REFERENCES experiences(id),
  ADD COLUMN IF NOT EXISTS contact_id text REFERENCES verified_contacts(id),
  ADD COLUMN IF NOT EXISTS shipping_snapshot_id text REFERENCES shipping_snapshots(id),
  ADD COLUMN IF NOT EXISTS object_type text,
  ADD COLUMN IF NOT EXISTS amount_minor bigint,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_provider_reference text;

ALTER TABLE issues
  ADD CONSTRAINT issues_status_check CHECK (
    status IN (
      'RESERVED',
      'RECEIVED',
      'BEING_INTERPRETED',
      'DESIGN_REVIEW',
      'DESIGN_APPROVED',
      'MANUFACTURING_DRAFT',
      'IN_PRODUCTION',
      'IN_TRANSIT',
      'DELIVERED',
      'EXCEPTION',
      'CANCELED'
    )
  ) NOT VALID;

ALTER TABLE issues
  ADD CONSTRAINT issues_object_type_check CHECK (
    object_type IS NULL OR object_type IN ('tee', 'hoodie', 'hat', 'tote')
  ) NOT VALID;

ALTER TABLE issues
  ADD CONSTRAINT issues_currency_check CHECK (
    currency IS NULL OR currency ~ '^[A-Z]{3}$'
  ) NOT VALID;

ALTER TABLE issues
  ADD CONSTRAINT issues_amount_minor_check CHECK (
    amount_minor IS NULL OR amount_minor > 0
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS issues_payment_attempt_unique_idx
  ON issues (payment_attempt_id)
  WHERE payment_attempt_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS issues_payment_provider_reference_idx
  ON issues (payment_provider, payment_provider_reference)
  WHERE payment_provider IS NOT NULL AND payment_provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS issues_experience_idx ON issues (experience_id);

CREATE INDEX IF NOT EXISTS issues_contact_idx ON issues (contact_id);

CREATE TABLE IF NOT EXISTS issue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source text NOT NULL,
  safe_detail jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS issue_events_issue_created_idx
  ON issue_events (issue_id, created_at ASC);

CREATE TABLE IF NOT EXISTS design_jobs (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('QUEUED','INTERPRETING','GENERATING','REVIEW','APPROVED','FAILED')),
  brief_payload_version smallint,
  brief_key_version text,
  brief_iv text,
  brief_auth_tag text,
  brief_ciphertext text,
  artwork_url text,
  artwork_mime_type text,
  artwork_bytes bigint,
  artwork_width integer,
  artwork_height integer,
  provider text,
  model text,
  failure_code text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (
    (brief_payload_version IS NULL AND brief_key_version IS NULL AND brief_iv IS NULL AND brief_auth_tag IS NULL AND brief_ciphertext IS NULL)
    OR
    (brief_payload_version = 1 AND brief_key_version = 'v1' AND brief_iv IS NOT NULL AND brief_auth_tag IS NOT NULL AND brief_ciphertext IS NOT NULL)
  ),
  CHECK (artwork_bytes IS NULL OR artwork_bytes > 0),
  CHECK (artwork_width IS NULL OR artwork_width > 0),
  CHECK (artwork_height IS NULL OR artwork_height > 0)
);

CREATE INDEX IF NOT EXISTS design_jobs_state_created_idx
  ON design_jobs (state, created_at);

CREATE TABLE IF NOT EXISTS manufacturing_jobs (
  id uuid PRIMARY KEY,
  issue_id uuid NOT NULL UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
  design_job_id uuid NOT NULL REFERENCES design_jobs(id),
  state text NOT NULL CHECK (state IN ('RESERVED','DRAFT','IN_PRODUCTION','SHIPPED','DELIVERED','FAILED','CANCELED')),
  provider text NOT NULL CHECK (provider = 'PRINTFUL'),
  provider_order_id text,
  provider_status text,
  printful_variant_id integer,
  artwork_url text NOT NULL,
  failure_code text,
  tracking_number text,
  tracking_url text,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (provider, provider_order_id),
  CHECK (printful_variant_id IS NULL OR printful_variant_id > 0)
);

CREATE INDEX IF NOT EXISTS manufacturing_jobs_state_created_idx
  ON manufacturing_jobs (state, created_at);

CREATE TABLE IF NOT EXISTS manufacturing_provider_events (
  provider text NOT NULL CHECK (provider = 'PRINTFUL'),
  provider_event_id text NOT NULL,
  provider_order_id text,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL,
  PRIMARY KEY (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS manufacturing_provider_events_order_idx
  ON manufacturing_provider_events (provider, provider_order_id, received_at DESC);

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

ALTER TABLE payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_status_check;

ALTER TABLE payment_attempts
  ADD CONSTRAINT payment_attempts_status_check
  CHECK (status IN ('CREATED','REDIRECTED','PAID','FAILED','REFUNDED','EXCEPTION'));

CREATE OR REPLACE FUNCTION block_paid_contact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS E'
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payment_attempts
    WHERE contact_id = OLD.id
      AND status IN (''CREATED'',''REDIRECTED'',''PAID'',''REFUNDED'',''EXCEPTION'')
  ) THEN
    RAISE EXCEPTION ''verified contact is locked by payment truth''
      USING ERRCODE = ''55000''\073
  END IF\073

  IF TG_OP = ''DELETE'' THEN
    RETURN OLD\073
  END IF\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS verified_contacts_payment_lock ON verified_contacts;

CREATE TRIGGER verified_contacts_payment_lock
BEFORE UPDATE OR DELETE ON verified_contacts
FOR EACH ROW
EXECUTE FUNCTION block_paid_contact_mutation();

CREATE OR REPLACE FUNCTION block_paid_shipping_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS E'
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payment_attempts
    WHERE shipping_snapshot_id = OLD.id
      AND status IN (''CREATED'',''REDIRECTED'',''PAID'',''REFUNDED'',''EXCEPTION'')
  ) THEN
    RAISE EXCEPTION ''shipping snapshot is locked by payment truth''
      USING ERRCODE = ''55000''\073
  END IF\073

  IF TG_OP = ''DELETE'' THEN
    RETURN OLD\073
  END IF\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS shipping_snapshots_payment_lock ON shipping_snapshots;

CREATE TRIGGER shipping_snapshots_payment_lock
BEFORE UPDATE OR DELETE ON shipping_snapshots
FOR EACH ROW
EXECUTE FUNCTION block_paid_shipping_mutation();

CREATE OR REPLACE FUNCTION enforce_issue_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS E'
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''RECEIVED'' AND NEW.status IN (''BEING_INTERPRETED'',''EXCEPTION'',''CANCELED'') THEN
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''BEING_INTERPRETED'' AND NEW.status IN (''DESIGN_REVIEW'',''EXCEPTION'',''CANCELED'') THEN
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''DESIGN_REVIEW'' AND NEW.status IN (''DESIGN_APPROVED'',''EXCEPTION'',''CANCELED'') THEN
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''DESIGN_APPROVED'' AND NEW.status IN (''MANUFACTURING_DRAFT'',''EXCEPTION'',''CANCELED'') THEN
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''MANUFACTURING_DRAFT'' AND NEW.status IN (''IN_PRODUCTION'',''EXCEPTION'',''CANCELED'') THEN
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''IN_PRODUCTION'' AND NEW.status IN (''IN_TRANSIT'',''EXCEPTION'',''CANCELED'') THEN
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''IN_TRANSIT'' AND NEW.status IN (''DELIVERED'',''EXCEPTION'',''CANCELED'') THEN
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''EXCEPTION'' AND NEW.status = ''CANCELED'' THEN
    RETURN NEW\073
  END IF\073

  RAISE EXCEPTION ''invalid Issue status transition: % -> %'', OLD.status, NEW.status
    USING ERRCODE = ''55000''\073
END\073
';

DROP TRIGGER IF EXISTS issues_status_state_machine ON issues;

CREATE TRIGGER issues_status_state_machine
BEFORE UPDATE OF status ON issues
FOR EACH ROW
EXECUTE FUNCTION enforce_issue_status_transition();

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS payment_exception_code TEXT,
  ADD COLUMN IF NOT EXISTS payment_exception_at TIMESTAMPTZ;

ALTER TABLE issues
  DROP CONSTRAINT IF EXISTS issues_payment_exception_code_check;

ALTER TABLE issues
  ADD CONSTRAINT issues_payment_exception_code_check
  CHECK (payment_exception_code IS NULL OR payment_exception_code IN ('PAYMENT_REFUNDED','PAYMENT_EXCEPTION'));

CREATE OR REPLACE FUNCTION project_payment_exception_to_issue()
RETURNS trigger
LANGUAGE plpgsql
AS E'
BEGIN
  IF NEW.status = ''REFUNDED'' AND OLD.status IS DISTINCT FROM ''REFUNDED'' THEN
    UPDATE issues
    SET payment_exception_code = ''PAYMENT_REFUNDED'',
        payment_exception_at = NEW.updated_at,
        updated_at = GREATEST(updated_at, NEW.updated_at)
    WHERE payment_attempt_id = NEW.id\073
  ELSIF NEW.status = ''EXCEPTION'' AND OLD.status IS DISTINCT FROM ''EXCEPTION'' THEN
    UPDATE issues
    SET payment_exception_code = COALESCE(payment_exception_code, ''PAYMENT_EXCEPTION''),
        payment_exception_at = COALESCE(payment_exception_at, NEW.updated_at),
        updated_at = GREATEST(updated_at, NEW.updated_at)
    WHERE payment_attempt_id = NEW.id\073
  END IF\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS payment_attempt_issue_exception_projection ON payment_attempts;

CREATE TRIGGER payment_attempt_issue_exception_projection
AFTER UPDATE OF status ON payment_attempts
FOR EACH ROW
WHEN (NEW.status IN ('REFUNDED','EXCEPTION'))
EXECUTE FUNCTION project_payment_exception_to_issue();

CREATE OR REPLACE FUNCTION enforce_issue_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS E'
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW\073
  END IF\073

  -- Once a factory charge has happened, financial exceptions are an overlay.
  -- Preserve the physical state so signed shipment/delivery truth can continue.
  IF OLD.status IN (''IN_PRODUCTION'',''IN_TRANSIT'')
     AND NEW.status = ''EXCEPTION''
     AND OLD.payment_exception_code IS NOT NULL THEN
    NEW.status := OLD.status\073
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''RECEIVED'' AND NEW.status IN (''BEING_INTERPRETED'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''BEING_INTERPRETED'' AND NEW.status IN (''DESIGN_REVIEW'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''DESIGN_REVIEW'' AND NEW.status IN (''DESIGN_APPROVED'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''DESIGN_APPROVED'' AND NEW.status IN (''MANUFACTURING_DRAFT'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''MANUFACTURING_DRAFT'' AND NEW.status IN (''IN_PRODUCTION'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''IN_PRODUCTION'' AND NEW.status IN (''IN_TRANSIT'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''IN_TRANSIT'' AND NEW.status IN (''DELIVERED'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''EXCEPTION'' AND NEW.status = ''CANCELED'' THEN RETURN NEW\073 END IF\073

  RAISE EXCEPTION ''invalid Issue status transition: % -> %'', OLD.status, NEW.status
    USING ERRCODE = ''55000''\073
END\073
';

CREATE OR REPLACE FUNCTION project_payment_exception_to_issue()
RETURNS trigger
LANGUAGE plpgsql
AS E'
DECLARE
  exception_code TEXT\073
BEGIN
  IF NEW.status = ''REFUNDED'' AND OLD.status IS DISTINCT FROM ''REFUNDED'' THEN
    exception_code := ''PAYMENT_REFUNDED''\073
  ELSIF NEW.status = ''EXCEPTION'' AND OLD.status IS DISTINCT FROM ''EXCEPTION'' THEN
    exception_code := ''PAYMENT_EXCEPTION''\073
  ELSE
    RETURN NEW\073
  END IF\073

  UPDATE issues
  SET payment_exception_code = CASE
        WHEN exception_code = ''PAYMENT_REFUNDED'' THEN ''PAYMENT_REFUNDED''
        ELSE COALESCE(payment_exception_code, exception_code)
      END,
      payment_exception_at = COALESCE(payment_exception_at, NEW.updated_at),
      status = CASE
        WHEN status IN (''RECEIVED'',''BEING_INTERPRETED'',''DESIGN_REVIEW'',''DESIGN_APPROVED'',''MANUFACTURING_DRAFT'')
          THEN ''EXCEPTION''
        ELSE status
      END,
      updated_at = GREATEST(updated_at, NEW.updated_at)
  WHERE payment_attempt_id = NEW.id\073

  RETURN NEW\073
END\073
';

CREATE OR REPLACE FUNCTION quarantine_provider_money_mismatch()
RETURNS trigger
LANGUAGE plpgsql
AS E'
BEGIN
  UPDATE payment_attempts
  SET status = ''EXCEPTION'',
      updated_at = GREATEST(updated_at, NEW.received_at)
  WHERE provider = NEW.provider
    AND provider_reference = NEW.provider_reference
    AND (amount_minor <> NEW.amount_minor OR currency <> NEW.currency)
    AND status <> ''EXCEPTION''\073

  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS payment_provider_money_consistency ON payment_provider_events;

CREATE TRIGGER payment_provider_money_consistency
AFTER INSERT ON payment_provider_events
FOR EACH ROW
EXECUTE FUNCTION quarantine_provider_money_mismatch();

CREATE OR REPLACE FUNCTION project_payment_exception_to_issue()
RETURNS trigger
LANGUAGE plpgsql
AS E'
DECLARE
  exception_code TEXT\073
BEGIN
  IF NEW.status = ''REFUNDED'' AND OLD.status IS DISTINCT FROM ''REFUNDED'' THEN
    exception_code := ''PAYMENT_REFUNDED''\073
  ELSIF NEW.status = ''EXCEPTION'' AND OLD.status IS DISTINCT FROM ''EXCEPTION'' THEN
    exception_code := ''PAYMENT_EXCEPTION''\073
  ELSE
    RETURN NEW\073
  END IF\073

  WITH projected AS (
    UPDATE issues
    SET payment_exception_code = CASE
          WHEN exception_code = ''PAYMENT_REFUNDED'' THEN ''PAYMENT_REFUNDED''
          ELSE COALESCE(payment_exception_code, exception_code)
        END,
        payment_exception_at = COALESCE(payment_exception_at, NEW.updated_at),
        status = CASE
          WHEN status IN (''RECEIVED'',''BEING_INTERPRETED'',''DESIGN_REVIEW'',''DESIGN_APPROVED'',''MANUFACTURING_DRAFT'')
            THEN ''EXCEPTION''
          ELSE status
        END,
        updated_at = GREATEST(updated_at, NEW.updated_at)
    WHERE payment_attempt_id = NEW.id
    RETURNING id,status
  )
  INSERT INTO issue_events(issue_id,event_type,source,safe_detail,created_at)
  SELECT id,exception_code,''SAFEPAY'',NULL,NEW.updated_at
  FROM projected
  WHERE status=''EXCEPTION''
    AND NOT EXISTS (
      SELECT 1 FROM issue_events existing
      WHERE existing.issue_id=projected.id
        AND existing.event_type=exception_code
        AND existing.source=''SAFEPAY''
    )\073

  RETURN NEW\073
END\073
';

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

CREATE TABLE IF NOT EXISTS ops_design_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  design_job_id uuid NOT NULL REFERENCES design_jobs(id) ON DELETE CASCADE,
  generation_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('AUTOMATIC','OWNER_REGENERATE','OWNER_REINTERPRET')),
  brief_payload_version smallint,
  brief_key_version text,
  brief_iv text,
  brief_auth_tag text,
  brief_ciphertext text,
  artwork_url text NOT NULL,
  artwork_mime_type text NOT NULL,
  artwork_bytes bigint NOT NULL CHECK (artwork_bytes > 0),
  artwork_width integer NOT NULL CHECK (artwork_width > 0),
  artwork_height integer NOT NULL CHECK (artwork_height > 0),
  provider text NOT NULL,
  model text NOT NULL,
  safe_summary text,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (issue_id, generation_key),
  CHECK (
    (brief_payload_version IS NULL AND brief_key_version IS NULL AND brief_iv IS NULL AND brief_auth_tag IS NULL AND brief_ciphertext IS NULL)
    OR
    (brief_payload_version = 1 AND brief_key_version = 'v1' AND brief_iv IS NOT NULL AND brief_auth_tag IS NOT NULL AND brief_ciphertext IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ops_design_candidates_selected_issue_idx
  ON ops_design_candidates (issue_id)
  WHERE selected;

CREATE INDEX IF NOT EXISTS ops_design_candidates_issue_created_idx
  ON ops_design_candidates (issue_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION enforce_issue_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS E'
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW\073 END IF\073

  IF OLD.status IN (''DESIGN_REVIEW'',''DESIGN_APPROVED'')
     AND NEW.status IN (''BEING_INTERPRETED'',''DESIGN_REVIEW'')
     AND NOT EXISTS (
       SELECT 1 FROM manufacturing_jobs manufacturing
       WHERE manufacturing.issue_id=OLD.id
         AND manufacturing.state IN (''DRAFT'',''IN_PRODUCTION'',''SHIPPED'',''DELIVERED'')
     ) THEN
    RETURN NEW\073
  END IF\073

  IF OLD.status IN (''IN_PRODUCTION'',''IN_TRANSIT'')
     AND NEW.status = ''EXCEPTION''
     AND OLD.payment_exception_code IS NOT NULL THEN
    NEW.status := OLD.status\073
    RETURN NEW\073
  END IF\073

  IF OLD.status = ''RECEIVED'' AND NEW.status IN (''BEING_INTERPRETED'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''BEING_INTERPRETED'' AND NEW.status IN (''DESIGN_REVIEW'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''DESIGN_REVIEW'' AND NEW.status IN (''DESIGN_APPROVED'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''DESIGN_APPROVED'' AND NEW.status IN (''MANUFACTURING_DRAFT'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''MANUFACTURING_DRAFT'' AND NEW.status IN (''IN_PRODUCTION'',''EXCEPTION'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''IN_PRODUCTION'' AND NEW.status IN (''IN_TRANSIT'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''IN_TRANSIT'' AND NEW.status IN (''DELIVERED'',''CANCELED'') THEN RETURN NEW\073 END IF\073
  IF OLD.status = ''EXCEPTION'' AND NEW.status = ''CANCELED'' THEN RETURN NEW\073 END IF\073

  RAISE EXCEPTION ''invalid Issue status transition: % -> %'', OLD.status, NEW.status
    USING ERRCODE = ''55000''\073
END\073
';

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

CREATE TABLE IF NOT EXISTS commercial_metric_buckets (
  bucket_day date NOT NULL,
  metric_key text NOT NULL,
  dimension_key text NOT NULL DEFAULT 'all',
  currency_scope text NOT NULL DEFAULT '*',
  event_count bigint NOT NULL DEFAULT 0,
  value_minor bigint NOT NULL DEFAULT 0,
  value_seconds numeric(24,3) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket_day, metric_key, dimension_key, currency_scope),
  CHECK (currency_scope='*' OR currency_scope ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS commercial_metric_buckets_metric_day_idx
  ON commercial_metric_buckets (metric_key, bucket_day DESC, dimension_key, currency_scope);

CREATE OR REPLACE FUNCTION commercial_metric_add(
  p_day date,
  p_metric text,
  p_dimension text,
  p_currency text,
  p_count bigint DEFAULT 0,
  p_minor bigint DEFAULT 0,
  p_seconds numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
AS E'
BEGIN
  INSERT INTO commercial_metric_buckets (
    bucket_day, metric_key, dimension_key, currency_scope,
    event_count, value_minor, value_seconds, updated_at
  ) VALUES (
    p_day, p_metric, COALESCE(NULLIF(p_dimension,''''),''all''), COALESCE(NULLIF(p_currency,''''),''*''),
    p_count, p_minor, p_seconds, NOW()
  )
  ON CONFLICT (bucket_day, metric_key, dimension_key, currency_scope)
  DO UPDATE SET
    event_count = commercial_metric_buckets.event_count + EXCLUDED.event_count,
    value_minor = commercial_metric_buckets.value_minor + EXCLUDED.value_minor,
    value_seconds = commercial_metric_buckets.value_seconds + EXCLUDED.value_seconds,
    updated_at = NOW()\073
END\073
';

CREATE OR REPLACE FUNCTION project_experience_metrics()
RETURNS trigger LANGUAGE plpgsql AS E'
BEGIN
  IF TG_OP=''INSERT'' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''funnel_started'',''all'',''*'',1,0,0)\073
  ELSIF NEW.stage IS DISTINCT FROM OLD.stage
    AND NEW.stage NOT IN (''VISITOR'',''EXPERIENCE_STARTED'',''QUESTION_1'',''QUESTION_2'',''QUESTION_3'',''QUESTION_4'',''QUESTION_5'',''QUESTION_6'',''QUESTION_7'')
    AND OLD.stage IN (''VISITOR'',''EXPERIENCE_STARTED'',''QUESTION_1'',''QUESTION_2'',''QUESTION_3'',''QUESTION_4'',''QUESTION_5'',''QUESTION_6'',''QUESTION_7'') THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE ''UTC'')::date,''funnel_answered'',''all'',''*'',1,0,0)\073
  END IF\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS experiences_metric_projection ON experiences;

CREATE TRIGGER experiences_metric_projection
AFTER INSERT OR UPDATE OF stage ON experiences
FOR EACH ROW EXECUTE FUNCTION project_experience_metrics();

CREATE OR REPLACE FUNCTION project_physical_metrics()
RETURNS trigger LANGUAGE plpgsql AS E'
BEGIN
  IF NEW.color_code IS NOT NULL AND (TG_OP=''INSERT'' OR OLD.color_code IS NULL) THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE ''UTC'')::date,''funnel_physical'',''all'',''*'',1,0,0)\073
  END IF\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS physical_metric_projection ON experience_physical_selection;

CREATE TRIGGER physical_metric_projection
AFTER INSERT OR UPDATE OF color_code ON experience_physical_selection
FOR EACH ROW EXECUTE FUNCTION project_physical_metrics();

CREATE OR REPLACE FUNCTION project_verified_contact_metrics()
RETURNS trigger LANGUAGE plpgsql AS E'
BEGIN
  PERFORM commercial_metric_add((NEW.verified_at AT TIME ZONE ''UTC'')::date,''funnel_verified'',''all'',''*'',1,0,0)\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS verified_contact_metric_projection ON verified_contacts;

CREATE TRIGGER verified_contact_metric_projection AFTER INSERT ON verified_contacts
FOR EACH ROW EXECUTE FUNCTION project_verified_contact_metrics();

CREATE OR REPLACE FUNCTION project_shipping_metrics()
RETURNS trigger LANGUAGE plpgsql AS E'
BEGIN
  PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''funnel_shipping'',''all'',''*'',1,0,0)\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS shipping_metric_projection ON shipping_snapshots;

CREATE TRIGGER shipping_metric_projection AFTER INSERT ON shipping_snapshots
FOR EACH ROW EXECUTE FUNCTION project_shipping_metrics();

CREATE OR REPLACE FUNCTION project_payment_metrics()
RETURNS trigger LANGUAGE plpgsql AS E'
DECLARE
  v_old_status text\073
BEGIN
  IF TG_OP=''INSERT'' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''funnel_checkout'',''all'',''*'',1,0,0)\073
    v_old_status := NULL\073
  ELSE
    v_old_status := OLD.status\073
  END IF\073

  IF NEW.status IN (''PAID'',''REFUNDED'') AND COALESCE(v_old_status,'''') NOT IN (''PAID'',''REFUNDED'') THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE ''UTC'')::date,''funnel_paid'',''all'',''*'',1,0,0)\073
  END IF\073
  IF NEW.status=''FAILED'' AND COALESCE(v_old_status,'''') <> ''FAILED'' THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE ''UTC'')::date,''payment_failed'',''all'',''*'',1,0,0)\073
  END IF\073
  IF NEW.status=''EXCEPTION'' AND COALESCE(v_old_status,'''') <> ''EXCEPTION'' THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE ''UTC'')::date,''payment_exception'',''all'',''*'',1,0,0)\073
  END IF\073
  IF NEW.status=''REFUNDED'' AND COALESCE(v_old_status,'''') <> ''REFUNDED'' THEN
    PERFORM commercial_metric_add((NEW.updated_at AT TIME ZONE ''UTC'')::date,''refund'',''all'',NEW.currency,1,NEW.amount_minor,0)\073
  END IF\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS payment_metric_projection ON payment_attempts;

CREATE TRIGGER payment_metric_projection AFTER INSERT OR UPDATE OF status ON payment_attempts
FOR EACH ROW EXECUTE FUNCTION project_payment_metrics();

CREATE OR REPLACE FUNCTION project_issue_metrics()
RETURNS trigger LANGUAGE plpgsql AS E'
DECLARE
  v_country text\073
  v_started timestamptz\073
BEGIN
  IF NEW.payment_attempt_id IS NULL OR NEW.currency IS NULL OR NEW.amount_minor IS NULL THEN RETURN NEW\073 END IF\073
  PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE ''UTC'')::date,''paid_order'',''all'',NEW.currency,1,0,0)\073
  PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE ''UTC'')::date,''gross_paid'',''all'',NEW.currency,1,NEW.amount_minor,0)\073
  IF NEW.object_type IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE ''UTC'')::date,''paid_order'',''object:''||NEW.object_type,NEW.currency,1,0,0)\073 END IF\073
  IF NEW.size_code IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE ''UTC'')::date,''paid_order'',''size:''||NEW.size_code,NEW.currency,1,0,0)\073 END IF\073
  IF NEW.color_code IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE ''UTC'')::date,''paid_order'',''color:''||NEW.color_code,NEW.currency,1,0,0)\073 END IF\073
  SELECT country_code INTO v_country FROM shipping_snapshots WHERE id=NEW.shipping_snapshot_id\073
  IF v_country IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE ''UTC'')::date,''paid_order'',''country:''||v_country,NEW.currency,1,0,0)\073 END IF\073
  SELECT created_at INTO v_started FROM experiences WHERE id=NEW.experience_id\073
  IF v_started IS NOT NULL THEN PERFORM commercial_metric_add((NEW.reserved_at AT TIME ZONE ''UTC'')::date,''timing_start_to_paid'',''all'',''*'',1,0,EXTRACT(EPOCH FROM (NEW.reserved_at-v_started)))\073 END IF\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS issue_metric_projection ON issues;

CREATE TRIGGER issue_metric_projection AFTER INSERT ON issues
FOR EACH ROW EXECUTE FUNCTION project_issue_metrics();

CREATE OR REPLACE FUNCTION project_issue_event_metrics()
RETURNS trigger LANGUAGE plpgsql AS E'
DECLARE
  v_reserved timestamptz\073
  v_prior timestamptz\073
BEGIN
  IF NEW.event_type=''IN_PRODUCTION'' THEN
    SELECT reserved_at INTO v_reserved FROM issues WHERE id=NEW.issue_id\073
    IF v_reserved IS NOT NULL THEN PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''timing_paid_to_production'',''all'',''*'',1,0,EXTRACT(EPOCH FROM (NEW.created_at-v_reserved)))\073 END IF\073
  ELSIF NEW.event_type=''DELIVERED'' THEN
    SELECT created_at INTO v_prior FROM issue_events
    WHERE issue_id=NEW.issue_id AND event_type=''IN_PRODUCTION'' AND created_at<=NEW.created_at
    ORDER BY created_at DESC LIMIT 1\073
    IF v_prior IS NOT NULL THEN PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''timing_production_to_delivered'',''all'',''*'',1,0,EXTRACT(EPOCH FROM (NEW.created_at-v_prior)))\073 END IF\073
  ELSIF NEW.event_type=''DESIGN_APPROVED'' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''design_approved'',''all'',''*'',1,0,0)\073
  ELSIF NEW.event_type=''DESIGN_REWORK_QUEUED'' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''design_rework'',COALESCE(''mode:''||(NEW.safe_detail->>''mode''),''mode:unknown''),''*'',1,0,0)\073
  END IF\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS issue_event_metric_projection ON issue_events;

CREATE TRIGGER issue_event_metric_projection AFTER INSERT ON issue_events
FOR EACH ROW EXECUTE FUNCTION project_issue_event_metrics();

CREATE OR REPLACE FUNCTION project_support_metrics()
RETURNS trigger LANGUAGE plpgsql AS E'
BEGIN
  PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''support_request'',''all'',''*'',1,0,0)\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS support_metric_projection ON support_requests;

CREATE TRIGGER support_metric_projection AFTER INSERT ON support_requests
FOR EACH ROW EXECUTE FUNCTION project_support_metrics();

CREATE INDEX IF NOT EXISTS issues_paid_reserved_idx
  ON issues (reserved_at DESC, id DESC)
  WHERE payment_attempt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS issues_status_updated_idx
  ON issues (status, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS issues_payment_exception_updated_idx
  ON issues (updated_at DESC, id DESC)
  WHERE payment_exception_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_attempts_status_created_idx
  ON payment_attempts (status, created_at DESC, id);

CREATE INDEX IF NOT EXISTS design_jobs_state_updated_idx
  ON design_jobs (state, updated_at ASC, id);

CREATE INDEX IF NOT EXISTS manufacturing_jobs_state_updated_idx
  ON manufacturing_jobs (state, updated_at ASC, id);

CREATE INDEX IF NOT EXISTS notification_deliveries_status_updated_idx
  ON notification_deliveries (status, updated_at ASC, id);

CREATE INDEX IF NOT EXISTS support_requests_status_updated_idx
  ON support_requests (status, updated_at ASC, id);

CREATE INDEX IF NOT EXISTS issue_events_created_idx
  ON issue_events (created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION project_issue_event_metrics()
RETURNS trigger LANGUAGE plpgsql AS E'
DECLARE
  v_reserved timestamptz\073
  v_prior timestamptz\073
BEGIN
  IF NEW.event_type=''IN_PRODUCTION'' THEN
    SELECT reserved_at INTO v_reserved FROM issues WHERE id=NEW.issue_id\073
    IF v_reserved IS NOT NULL THEN
      PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''timing_paid_to_production'',''all'',''*'',1,0,EXTRACT(EPOCH FROM (NEW.created_at-v_reserved)))\073
    END IF\073
  ELSIF NEW.event_type=''DELIVERED'' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''delivered'',''all'',''*'',1,0,0)\073
    SELECT created_at INTO v_prior FROM issue_events
    WHERE issue_id=NEW.issue_id AND event_type=''IN_PRODUCTION'' AND created_at<=NEW.created_at
    ORDER BY created_at DESC LIMIT 1\073
    IF v_prior IS NOT NULL THEN
      PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''timing_production_to_delivered'',''all'',''*'',1,0,EXTRACT(EPOCH FROM (NEW.created_at-v_prior)))\073
    END IF\073
  ELSIF NEW.event_type=''DESIGN_APPROVED'' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''design_approved'',''all'',''*'',1,0,0)\073
  ELSIF NEW.event_type=''DESIGN_REWORK_QUEUED'' THEN
    PERFORM commercial_metric_add((NEW.created_at AT TIME ZONE ''UTC'')::date,''design_rework'',COALESCE(''mode:''||(NEW.safe_detail->>''mode''),''mode:unknown''),''*'',1,0,0)\073
  END IF\073
  RETURN NEW\073
END\073
';

CREATE INDEX IF NOT EXISTS issues_updated_id_idx
  ON issues (updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS issues_shipping_snapshot_idx
  ON issues (shipping_snapshot_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS shipping_snapshots_country_id_idx
  ON shipping_snapshots (country_code, id);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS issues_issue_code_trgm_idx
  ON issues USING gin (issue_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS issues_payment_provider_reference_trgm_idx
  ON issues USING gin (payment_provider_reference gin_trgm_ops)
  WHERE payment_provider_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS manufacturing_provider_order_trgm_idx
  ON manufacturing_jobs USING gin (provider_order_id gin_trgm_ops)
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS manufacturing_tracking_trgm_idx
  ON manufacturing_jobs USING gin (tracking_number gin_trgm_ops)
  WHERE tracking_number IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS referral_creators (
  id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120),
  email_hash text NOT NULL CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  email_payload_version smallint NOT NULL CHECK (email_payload_version = 1),
  email_key_version text NOT NULL CHECK (email_key_version = 'v1'),
  email_iv text NOT NULL,
  email_auth_tag text NOT NULL,
  email_ciphertext text NOT NULL,
  normalized_code text NOT NULL UNIQUE CHECK (normalized_code ~ '^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS referral_creators_email_hash_idx
  ON referral_creators (email_hash);

CREATE INDEX IF NOT EXISTS referral_creators_active_code_idx
  ON referral_creators (normalized_code)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS referral_rule_versions (
  id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES referral_creators(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  code_snapshot text NOT NULL CHECK (code_snapshot ~ '^[A-Z0-9][A-Z0-9-]{1,30}[A-Z0-9]$'),
  customer_discount_mode text NOT NULL CHECK (customer_discount_mode IN ('PERCENT','FIXED')),
  customer_discount_bps integer,
  customer_discount_fixed_minor bigint,
  creator_reward_mode text NOT NULL CHECK (creator_reward_mode IN ('PERCENT','FIXED')),
  creator_reward_bps integer,
  creator_reward_fixed_minor bigint,
  payout_cadence text NOT NULL CHECK (payout_cadence IN ('MONTHLY','THRESHOLD')),
  payout_threshold_minor bigint,
  attribution_window_days integer NOT NULL CHECK (attribution_window_days > 0),
  created_at timestamptz NOT NULL,
  UNIQUE (creator_id, version),
  CHECK (
    (customer_discount_mode = 'PERCENT' AND customer_discount_bps BETWEEN 1 AND 9999 AND customer_discount_fixed_minor IS NULL)
    OR
    (customer_discount_mode = 'FIXED' AND customer_discount_fixed_minor > 0 AND customer_discount_bps IS NULL)
  ),
  CHECK (
    (creator_reward_mode = 'PERCENT' AND creator_reward_bps BETWEEN 1 AND 10000 AND creator_reward_fixed_minor IS NULL)
    OR
    (creator_reward_mode = 'FIXED' AND creator_reward_fixed_minor > 0 AND creator_reward_bps IS NULL)
  ),
  CHECK (
    (payout_cadence = 'MONTHLY' AND payout_threshold_minor IS NULL)
    OR
    (payout_cadence = 'THRESHOLD' AND payout_threshold_minor > 0)
  )
);

CREATE INDEX IF NOT EXISTS referral_rule_versions_creator_version_idx
  ON referral_rule_versions (creator_id, version DESC);

CREATE TABLE IF NOT EXISTS referral_attributions (
  id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES referral_creators(id) ON DELETE RESTRICT,
  rule_version_id uuid NOT NULL REFERENCES referral_rule_versions(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('LINK','CODE')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS referral_attributions_creator_created_idx
  ON referral_attributions (creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS referral_attributions_expires_idx
  ON referral_attributions (expires_at);

ALTER TABLE checkout_quotes
  ADD COLUMN IF NOT EXISTS gross_amount_minor integer,
  ADD COLUMN IF NOT EXISTS discount_amount_minor integer,
  ADD COLUMN IF NOT EXISTS referral_attribution_id uuid REFERENCES referral_attributions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS referral_creator_id uuid REFERENCES referral_creators(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS referral_rule_version_id uuid REFERENCES referral_rule_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS referral_rule_snapshot jsonb;

CREATE OR REPLACE FUNCTION fill_checkout_quote_referral_amounts()
RETURNS trigger
LANGUAGE plpgsql
AS E'
BEGIN
  IF NEW.gross_amount_minor IS NULL THEN
    NEW.gross_amount_minor := NEW.amount_minor\073
  END IF\073
  IF NEW.discount_amount_minor IS NULL THEN
    NEW.discount_amount_minor := 0\073
  END IF\073
  RETURN NEW\073
END\073
';

DROP TRIGGER IF EXISTS checkout_quotes_fill_referral_amounts ON checkout_quotes;

CREATE TRIGGER checkout_quotes_fill_referral_amounts
BEFORE INSERT ON checkout_quotes
FOR EACH ROW EXECUTE FUNCTION fill_checkout_quote_referral_amounts();

UPDATE checkout_quotes
SET gross_amount_minor = amount_minor,
    discount_amount_minor = 0
WHERE gross_amount_minor IS NULL OR discount_amount_minor IS NULL;

ALTER TABLE checkout_quotes
  ALTER COLUMN gross_amount_minor SET NOT NULL,
  ALTER COLUMN discount_amount_minor SET NOT NULL;

ALTER TABLE checkout_quotes
  DROP CONSTRAINT IF EXISTS checkout_quotes_referral_amounts_check,
  DROP CONSTRAINT IF EXISTS checkout_quotes_referral_snapshot_check;

ALTER TABLE checkout_quotes
  ADD CONSTRAINT checkout_quotes_referral_amounts_check CHECK (
    gross_amount_minor > 0
    AND discount_amount_minor >= 0
    AND amount_minor > 0
    AND gross_amount_minor - discount_amount_minor = amount_minor
  ),
  ADD CONSTRAINT checkout_quotes_referral_snapshot_check CHECK (
    (
      referral_attribution_id IS NULL
      AND referral_creator_id IS NULL
      AND referral_rule_version_id IS NULL
      AND referral_rule_snapshot IS NULL
      AND discount_amount_minor = 0
    )
    OR
    (
      referral_attribution_id IS NOT NULL
      AND referral_creator_id IS NOT NULL
      AND referral_rule_version_id IS NOT NULL
      AND referral_rule_snapshot IS NOT NULL
      AND discount_amount_minor > 0
    )
  );

CREATE INDEX IF NOT EXISTS checkout_quotes_referral_creator_created_idx
  ON checkout_quotes (referral_creator_id, created_at DESC)
  WHERE referral_creator_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS referral_conversions (
  id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES referral_creators(id) ON DELETE RESTRICT,
  rule_version_id uuid NOT NULL REFERENCES referral_rule_versions(id) ON DELETE RESTRICT,
  payment_attempt_id text NOT NULL UNIQUE REFERENCES payment_attempts(id) ON DELETE RESTRICT,
  issue_id uuid REFERENCES issues(id) ON DELETE SET NULL,
  gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor > 0),
  discount_amount_minor bigint NOT NULL CHECK (discount_amount_minor >= 0),
  paid_amount_minor bigint NOT NULL CHECK (paid_amount_minor > 0),
  reward_amount_minor bigint NOT NULL CHECK (reward_amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  rule_snapshot jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING','AVAILABLE','REVERSED','PAID_OUT')),
  converted_at timestamptz NOT NULL,
  available_at timestamptz,
  reversed_at timestamptz,
  paid_out_at timestamptz,
  updated_at timestamptz NOT NULL,
  CHECK (gross_amount_minor - discount_amount_minor = paid_amount_minor),
  CHECK ((state <> 'AVAILABLE') OR available_at IS NOT NULL),
  CHECK ((state <> 'REVERSED') OR reversed_at IS NOT NULL),
  CHECK ((state <> 'PAID_OUT') OR paid_out_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS referral_conversions_creator_state_idx
  ON referral_conversions (creator_id, state, converted_at DESC);

CREATE INDEX IF NOT EXISTS referral_conversions_issue_idx
  ON referral_conversions (issue_id)
  WHERE issue_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS referral_notification_deliveries (
  id uuid PRIMARY KEY,
  conversion_id uuid NOT NULL REFERENCES referral_conversions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('SALE','REVERSAL')),
  state text NOT NULL CHECK (state IN ('QUEUED','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  sent_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (conversion_id, kind)
);

CREATE TABLE IF NOT EXISTS referral_payout_requests (
  id uuid PRIMARY KEY,
  creator_id uuid NOT NULL REFERENCES referral_creators(id) ON DELETE RESTRICT,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  requested_amount_minor bigint NOT NULL CHECK (requested_amount_minor > 0),
  details_payload_version smallint NOT NULL CHECK (details_payload_version = 1),
  details_key_version text NOT NULL CHECK (details_key_version = 'v1'),
  details_iv text NOT NULL,
  details_auth_tag text NOT NULL,
  details_ciphertext text NOT NULL,
  status text NOT NULL CHECK (status IN ('REQUESTED','PAID','CANCELLED')),
  settlement_reference text,
  requested_at timestamptz NOT NULL,
  paid_at timestamptz,
  updated_at timestamptz NOT NULL,
  CHECK ((status <> 'PAID') OR paid_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS referral_payout_requests_creator_status_idx
  ON referral_payout_requests (creator_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS referral_payout_allocations (
  payout_id uuid NOT NULL REFERENCES referral_payout_requests(id) ON DELETE RESTRICT,
  conversion_id uuid NOT NULL UNIQUE REFERENCES referral_conversions(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  allocated_at timestamptz NOT NULL,
  PRIMARY KEY (payout_id, conversion_id)
);
